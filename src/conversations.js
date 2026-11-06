export function attendanceContacts(contacts,search='',kind='all') {
 const term=search.trim().toLocaleLowerCase('pt-BR');
 return contacts.filter(c=>!c.redirectTo&&(c.lastAt||kind==='groups'&&c.isGroup)&&
  (kind!=='groups'||c.isGroup)&&(kind!=='direct'||!c.isGroup)&&
  `${c.name||''} ${c.phone||''}`.toLocaleLowerCase('pt-BR').includes(term));
}
