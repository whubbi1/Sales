# backend/app/routers/admin.py - replace get_costs function with this

ACCOUNT_NAMES = {
    "351007427901": {"name": "WCOMPLY Main",  "color": "#156082", "icon": "🏢"},
    "607025226712": {"name": "WCOMPLY Prod",  "color": "#e97132", "icon": "🚀"},
    "882321772619": {"name": "WCOMPLY WHUBBI","color": "#45B6E4", "icon": "🎯"},
}

@router.get("/costs/multi")
async def get_multi_account_costs():
    """Get AWS costs broken down by account."""
    try:
        import boto3
        from datetime import datetime, timedelta
        ce = boto3.client("ce", region_name="us-east-1")

        now = datetime.utcnow()
        start = now.replace(day=1).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")

        # Total by account
        by_account = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["BlendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "LINKED_ACCOUNT"}]
        )

        accounts = []
        total = 0.0
        for group in by_account["ResultsByTime"][0].get("Groups", []):
            account_id = group["Keys"][0]
            cost = float(group["Metrics"]["BlendedCost"]["Amount"])
            total += cost
            info = ACCOUNT_NAMES.get(account_id, {"name": account_id, "color": "#848EA5", "icon": "☁️"})
            accounts.append({
                "account_id": account_id,
                "name": info["name"],
                "color": info["color"],
                "icon": info["icon"],
                "cost": round(cost, 2),
            })

        # Sort by cost desc
        accounts.sort(key=lambda x: x["cost"], reverse=True)

        # Daily trend (last 30 days) by account
        start_30 = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        daily = ce.get_cost_and_usage(
            TimePeriod={"Start": start_30, "End": end},
            Granularity="DAILY",
            Metrics=["BlendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "LINKED_ACCOUNT"}]
        )

        daily_data = []
        for day in daily["ResultsByTime"]:
            entry = {"date": day["TimePeriod"]["Start"]}
            for group in day.get("Groups", []):
                acc_id = group["Keys"][0]
                entry[acc_id] = round(float(group["Metrics"]["BlendedCost"]["Amount"]), 2)
            daily_data.append(entry)

        return {
            "period": {"start": start, "end": end},
            "total": round(total, 2),
            "accounts": accounts,
            "daily_trend": daily_data,
        }

    except Exception as e:
        return {"error": str(e), "total": 0, "accounts": [], "daily_trend": []}


@router.get("/costs/account/{account_id}")
async def get_account_costs(account_id: str):
    """Get detailed costs for a specific account."""
    try:
        import boto3
        from datetime import datetime, timedelta
        ce = boto3.client("ce", region_name="us-east-1")

        now = datetime.utcnow()
        start = now.replace(day=1).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")

        # Filter by account
        account_filter = {
            "Dimensions": {
                "Key": "LINKED_ACCOUNT",
                "Values": [account_id]
            }
        }

        # By service
        by_service = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["BlendedCost"],
            Filter=account_filter,
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}]
        )

        services = []
        total = 0.0
        for group in by_service["ResultsByTime"][0].get("Groups", []):
            cost = float(group["Metrics"]["BlendedCost"]["Amount"])
            if cost > 0.001:
                total += cost
                services.append({
                    "service": group["Keys"][0],
                    "cost": round(cost, 2)
                })
        services.sort(key=lambda x: x["cost"], reverse=True)

        # Daily for this month
        daily = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="DAILY",
            Metrics=["BlendedCost"],
            Filter=account_filter,
        )
        daily_data = [{"date": d["TimePeriod"]["Start"], "cost": round(float(d["Total"]["BlendedCost"]["Amount"]), 2)} for d in daily["ResultsByTime"]]

        # Last 3 months
        start_3m = (now.replace(day=1) - timedelta(days=90)).strftime("%Y-%m-%d")
        monthly = ce.get_cost_and_usage(
            TimePeriod={"Start": start_3m, "End": end},
            Granularity="MONTHLY",
            Metrics=["BlendedCost"],
            Filter=account_filter,
        )
        monthly_data = [{"month": d["TimePeriod"]["Start"][:7], "cost": round(float(d["Total"]["BlendedCost"]["Amount"]), 2)} for d in monthly["ResultsByTime"]]

        info = ACCOUNT_NAMES.get(account_id, {"name": account_id, "color": "#848EA5", "icon": "☁️"})
        return {
            "account_id": account_id,
            "name": info["name"],
            "color": info["color"],
            "icon": info["icon"],
            "period": {"start": start, "end": end},
            "total": round(total, 2),
            "by_service": services,
            "daily": daily_data,
            "monthly": monthly_data,
        }

    except Exception as e:
        return {"error": str(e), "total": 0, "by_service": [], "daily": [], "monthly": []}
