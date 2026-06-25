export const API = 'https://api.whubbi.wcomply.com'

export const STATUS_STYLE: Record<string,{bg:string;color:string;label:string}> = {
  new:         {bg:'#EEF2FF',color:'#4F46E5',label:'New'},
  open:        {bg:'#FFF7ED',color:'#D97706',label:'Open'},
  in_progress: {bg:'#EFF6FF',color:'#156082',label:'In Progress'},
  pending:     {bg:'#F5F3FF',color:'#7C3AED',label:'Pending'},
  resolved:    {bg:'#ECFDF5',color:'#059669',label:'Resolved'},
  closed:      {bg:'#F1F5F9',color:'#45B6E4',label:'Closed'},
}

export const PRIORITY_STYLE: Record<string,{bg:string;color:string;dot:string}> = {
  critical:{bg:'#FEF2F2',color:'#DC2626',dot:'#EF4444'},
  high:    {bg:'#FFF7ED',color:'#D97706',dot:'#F59E0B'},
  medium:  {bg:'#EFF6FF',color:'#156082',dot:'#45B6E4'},
  low:     {bg:'#F1F5F9',color:'#45B6E4',dot:'#94A3B8'},
}

export const BTN = {
  primary: {background:'#156082',color:'white',border:'none',padding:'8px 18px',borderRadius:'7px',fontSize:'12px',fontWeight:'700' as const,cursor:'pointer' as const,fontFamily:'Montserrat, sans-serif'},
  secondary: {background:'white',color:'#156082',border:'1.5px solid #45B6E4',padding:'7px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'600' as const,cursor:'pointer' as const,fontFamily:'Montserrat, sans-serif'},
  danger: {background:'#FEF2F2',color:'#DC2626',border:'none',padding:'7px 14px',borderRadius:'7px',fontSize:'12px',fontWeight:'600' as const,cursor:'pointer' as const,fontFamily:'Montserrat, sans-serif'},
}
