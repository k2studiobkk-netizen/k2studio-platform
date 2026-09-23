import{destroyStaffSession}from"../../../staff-auth";export async function GET(){return new Response(null,{status:302,headers:{location:"/admin/login","set-cookie":await destroyStaffSession()}})}
