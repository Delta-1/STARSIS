declare module '*flow-domain.js' {
 export function validateFlow(flow:any):string|null;
 export function handles(node:any):string[];
 export function nextNode(flow:any,id:string,handle?:string):string|null;
 export function simulateFlow(flow:any,text:string,clips?:any[]):string[];
}
