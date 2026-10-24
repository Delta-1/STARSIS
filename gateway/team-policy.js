export const staffVisible=(employee,contact)=>!contact.redirectTo&&(!contact.assignedTo||contact.assignedTo===employee.id);
export const staffCanReply=(employee,contact)=>!contact.redirectTo&&contact.assignedTo===employee.id&&contact.attendanceStatus!=='closed';
export const attendanceColumn=contact=>contact.attendanceStatus==='closed'?'closed':contact.assignedTo||['active','replied'].includes(contact.attendanceStatus)?'active':'waiting';
export const safeEmployee=e=>({id:e.id,name:e.name,active:e.active!==false,createdAt:e.createdAt});
