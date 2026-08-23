# infrastructure/terraform/ecs.tf
# Backend FastAPI sur AWS ECS Fargate

resource "aws_ecr_repository" "backend" {
  name                 = "whubbi-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "whubbi-backend-ecr" }
}

# Security Group ECS
resource "aws_security_group" "ecs" {
  name        = "whubbi-ecs-sg"
  description = "Acces HTTP depuis ALB uniquement"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP depuis ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "whubbi-ecs-sg" }
}

# Security Group ALB
resource "aws_security_group" "alb" {
  name        = "whubbi-alb-sg"
  description = "Acces public HTTP HTTPS"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "whubbi-alb-sg" }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "whubbi-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = { Name = "whubbi-alb" }
}

resource "aws_lb_target_group" "backend" {
  name        = "whubbi-backend-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

# Listener HTTP (port 80) - redirige tout vers HTTPS, ne sert plus jamais l'app en clair
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Listener HTTPS (port 443) - depend de la validation DNS du certificat ACM
# (voir secrets.tf: aws_acm_certificate_validation.main), donc ce listener ne
# peut pas exister tant que le CNAME de validation n'a pas ete ajoute au DNS.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "whubbi-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "whubbi-cluster" }
}

# IAM Role ECS
resource "aws_iam_role" "ecs_task_execution" {
  name = "whubbi-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_secrets" {
  name = "whubbi-ecs-secrets-policy"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "ssm:GetParameters",
        "ssm:GetParameter"
      ]
      Resource = "*"
    }]
  })
}

# ECS Task Definition
resource "aws_ecs_task_definition" "backend" {
  family                   = "whubbi-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "whubbi-backend"
    image = "${aws_ecr_repository.backend.repository_url}:latest"

    portMappings = [{
      containerPort = 8000
      protocol      = "tcp"
    }]

    environment = [
      { name = "ENVIRONMENT", value = var.environment },
      { name = "APP_NAME",    value = "whubbi" },
      # Real server-side verification of the Cognito ID token the frontend sends as
      # `Authorization: Bearer` (see app/routers/settings.py get_verified_email) —
      # previously not passed to this task at all, so the backend had no way to
      # verify anything even if it wanted to. Not secrets: a user pool ID, region,
      # and app client ID are not sensitive (the frontend already ships the same
      # three values to the browser as NEXT_PUBLIC_* build-time env vars).
      { name = "COGNITO_USER_POOL_ID", value = aws_cognito_user_pool.main.id },
      { name = "COGNITO_REGION",       value = var.aws_region },
      # The "frontend" app client is the one whose OAuth/PKCE flow actually issues
      # the ID tokens the browser sends — not the separate "backend" client (direct
      # USER_PASSWORD_AUTH, unrelated to this flow) — so this must match its ID
      # exactly, or every token's audience check would fail closed.
      { name = "COGNITO_CLIENT_ID", value = aws_cognito_user_pool_client.frontend.id }
    ]

    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_ssm_parameter.db_url.arn
      },
      {
        name      = "MS_TENANT_ID"
        valueFrom = "/whubbi/${var.environment}/microsoft/tenant_id"
      },
      {
        name      = "MS_CLIENT_ID"
        valueFrom = "/whubbi/${var.environment}/microsoft/client_id"
      },
      {
        name      = "MS_CLIENT_SECRET"
        valueFrom = "/whubbi/${var.environment}/microsoft/client_secret"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/whubbi-backend"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/whubbi-backend"
  retention_in_days = 30
}

# ECS Service
resource "aws_ecs_service" "backend" {
  name            = "whubbi-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "whubbi-backend"
    container_port   = 8000
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 10
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_cpu" {
  name               = "whubbi-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
