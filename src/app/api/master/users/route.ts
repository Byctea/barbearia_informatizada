import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { invitationEmail, sendTransactionalEmail } from "@/lib/email";

const fail=(error:string,status:number)=>NextResponse.json({error},{status});
const createSchema=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254),role:z.enum(["ADMIN","CLIENT"]),barbershopId:z.string().optional(),unitId:z.string().optional(),phone:z.string().trim().max(24).optional()});
const editSchema=z.object({id:z.string().min(1),name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254)});
async function tokenHash(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");}

export async function GET(){
  const master=await getPlatformAdmin();if(!master)return fail("Acesso master necessário.",403);
  const users=await master.db.prepare(`SELECT u.id,u.name,u.email,u.role,u.createdAt,
    (SELECT GROUP_CONCAT(DISTINCT b.name) FROM memberships m JOIN barbershops b ON b.id=m.barbershop_id WHERE m.user_id=u.id AND m.is_active=1) AS barbershops,
    (SELECT COUNT(*) FROM memberships m WHERE m.user_id=u.id AND m.is_active=1) AS active_memberships,
    (SELECT GROUP_CONCAT(DISTINCT br.display_name) FROM barbers br JOIN users pu ON pu.id=br.user_id WHERE pu.auth_subject=u.id AND br.is_active=1) AS barber_names,
    (SELECT COUNT(*) FROM customers c JOIN users pu ON pu.id=c.user_id WHERE pu.auth_subject=u.id AND c.deleted_at IS NULL) AS customer_records
    FROM user u ORDER BY u.createdAt DESC LIMIT 1000`).all();
  const barbershops=await master.db.prepare(`SELECT b.id,b.name,u.id AS unit_id,u.name AS unit_name FROM barbershops b JOIN units u ON u.barbershop_id=b.id AND u.is_active=1 WHERE b.is_active=1 ORDER BY b.name COLLATE NOCASE,u.name COLLATE NOCASE`).all();
  return NextResponse.json({users:users.results,barbershops:barbershops.results});
}

export async function PATCH(request:Request){
  const master=await getPlatformAdmin();if(!master)return fail("Acesso master necessário.",403);
  const parsed=editSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail("Informe nome e e-mail válidos.",400);
  const {id,name,email}=parsed.data;
  try{
    const target=await master.db.prepare("SELECT id FROM user WHERE id=?").bind(id).first<{id:string}>();if(!target)return fail("Usuário não encontrado.",404);
    await master.db.batch([
      master.db.prepare("UPDATE user SET name=?,email=?,emailVerified=0,updatedAt=CURRENT_TIMESTAMP WHERE id=?").bind(name,email.toLowerCase(),id),
      master.db.prepare("UPDATE users SET display_name=?,email=? WHERE auth_subject=? AND deleted_at IS NULL").bind(name,email.toLowerCase(),id),
      master.db.prepare("UPDATE customers SET full_name=?,email=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=(SELECT id FROM users WHERE auth_subject=?) AND deleted_at IS NULL").bind(name,email.toLowerCase(),id),
    ]);
    return NextResponse.json({ok:true,message:"Usuário atualizado."});
  }catch(error){console.error("master user update failed",error);return fail("Não foi possível atualizar. O e-mail pode já estar em uso.",409);}
}

export async function DELETE(request:Request){
  const master=await getPlatformAdmin();if(!master)return fail("Acesso master necessário.",403);
  const body=await request.json().catch(()=>null) as {id?:unknown}|null;if(typeof body?.id!=="string"||!body.id)return fail("Usuário inválido.",400);
  const id=body.id;if(id===master.userId)return fail("Não é possível excluir a própria conta master.",409);
  const privileged=await master.db.prepare("SELECT 1 FROM platform_admins WHERE user_id=? AND is_active=1").bind(id).first();if(privileged)return fail("Uma conta de administrador master não pode ser excluída por esta tela.",409);
  const target=await master.db.prepare("SELECT id FROM user WHERE id=?").bind(id).first<{id:string}>();if(!target)return fail("Usuário não encontrado.",404);
  try{
    const dependencies=await master.db.prepare(`SELECT
      EXISTS(SELECT 1 FROM appointments a JOIN customers c ON c.id=a.customer_id WHERE c.user_id=u.id) OR
      EXISTS(SELECT 1 FROM store_orders o JOIN customers c ON c.id=o.customer_id WHERE c.user_id=u.id) OR
      EXISTS(SELECT 1 FROM customers c WHERE c.user_id=u.id AND c.deleted_at IS NULL) OR
      EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=p.id) OR
      EXISTS(SELECT 1 FROM barbers br JOIN users pu ON pu.id=br.user_id WHERE pu.auth_subject=u.id AND br.is_active=1) AS has_history
      FROM user u JOIN users p ON p.auth_subject=u.id WHERE u.id=?`).bind(id).first<{has_history:number}>();
    if(dependencies?.has_history){
      await master.db.batch([
        master.db.prepare("UPDATE memberships SET is_active=0 WHERE user_id=(SELECT id FROM users WHERE auth_subject=?)").bind(id),
        master.db.prepare("UPDATE barbers SET is_active=0 WHERE user_id=(SELECT id FROM users WHERE auth_subject=?)").bind(id),
        master.db.prepare("UPDATE customers SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE user_id=(SELECT id FROM users WHERE auth_subject=?) AND deleted_at IS NULL").bind(id),
        master.db.prepare("UPDATE users SET deleted_at=CURRENT_TIMESTAMP WHERE auth_subject=? AND deleted_at IS NULL").bind(id),
        master.db.prepare("DELETE FROM session WHERE userId=?").bind(id),
      ]);
      return NextResponse.json({ok:true,deleted:false,message:"Usuário desativado. Os históricos foram preservados."});
    }
    await master.db.batch([
      master.db.prepare("DELETE FROM users WHERE auth_subject=?").bind(id),
      master.db.prepare("DELETE FROM user WHERE id=? AND NOT EXISTS(SELECT 1 FROM platform_admins WHERE user_id=? AND is_active=1)").bind(id,id),
    ]);
    return NextResponse.json({ok:true,deleted:true,message:"Usuário excluído."});
  }catch(error){console.error("master user delete failed",error);return fail("Não foi possível excluir o usuário; ele pode estar ligado a um histórico.",409);}
}

export async function POST(request:Request){
  const master=await getPlatformAdmin();if(!master)return fail("Acesso master necessário.",403);
  const parsed=createSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail("Informe nome, e-mail e perfil válidos.",400);
  const {name,email,role,barbershopId,unitId,phone}=parsed.data;const cleanEmail=email.toLowerCase();
  if(role==="ADMIN"&&(!barbershopId||!unitId))return fail("Selecione a barbearia e a unidade para o administrador.",400);
  if(role==="CLIENT"&&barbershopId&&!unitId)return fail("Selecione a unidade para vincular o cliente.",400);
  if(barbershopId){const unit=await master.db.prepare("SELECT id FROM units WHERE id=? AND barbershop_id=? AND is_active=1").bind(unitId,barbershopId).first();if(!unit)return fail("Barbearia/unidade inválida ou inativa.",400);}
  try{
    const existing=await master.db.prepare("SELECT id FROM user WHERE lower(email)=lower(?)").bind(cleanEmail).first<{id:string}>();
    let userId=existing?.id;
    if(existing){const already=role==="ADMIN"?await master.db.prepare("SELECT 1 FROM memberships WHERE user_id=(SELECT id FROM users WHERE auth_subject=?) AND barbershop_id=? AND unit_id=? AND role='ADMIN' AND is_active=1").bind(userId,barbershopId,unitId).first():null;if(already)return fail("Este usuário já administra essa unidade.",409);}
    const invitationId=crypto.randomUUID();const rawToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");const expires=new Date(Date.now()+72*60*60_000).toISOString();const now=new Date().toISOString();
    if(role==="ADMIN"){
      await master.db.batch([
        master.db.prepare("INSERT INTO tenant_admin_invitations (id,barbershop_id,unit_id,admin_name,email,token_hash,invited_by,expires_at) VALUES (?,?,?,?,?,?,?,?)").bind(invitationId,barbershopId,unitId,name,cleanEmail,await tokenHash(rawToken),master.userId,expires),
      ]);
    }else if(barbershopId&&userId){
      if(phone)await master.db.prepare("UPDATE users SET phone=? WHERE auth_subject=?").bind(phone,userId).run();
      const customerId=crypto.randomUUID();
      await master.db.batch([
        master.db.prepare("INSERT INTO memberships (id,barbershop_id,unit_id,user_id,role,is_active) VALUES (?,?,?,?,'CLIENT',1) ON CONFLICT(barbershop_id,user_id,unit_id) DO UPDATE SET role='CLIENT',is_active=1").bind(crypto.randomUUID(),barbershopId,unitId,userId),
        master.db.prepare("INSERT INTO customers (id,barbershop_id,unit_id,user_id,full_name,phone,email,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM customers WHERE user_id=? AND barbershop_id=? AND unit_id=? AND deleted_at IS NULL)").bind(customerId,barbershopId,unitId,userId,name,phone??"",cleanEmail,now,now,userId,barbershopId,unitId),
      ]);
    }
    const baseUrl=new URL(request.url).origin;let invitationUrl:string;
    if(role==="ADMIN")invitationUrl=`${baseUrl}/convite/${rawToken}`;
    else if(barbershopId){
      const clientToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
      const clientInviteId=crypto.randomUUID();
      await master.db.prepare("INSERT INTO customer_invitations (id,barbershop_id,unit_id,email,customer_name,token_hash,invited_by,expires_at) VALUES (?,?,?,?,?,?,?,?)").bind(clientInviteId,barbershopId,unitId,cleanEmail,name,await tokenHash(clientToken),master.userId,expires).run();
      invitationUrl=`${baseUrl}/convite-cliente/${clientToken}`;
    }else invitationUrl=`${baseUrl}${existing?"/entrar":"/cadastro"}`;
    const delivery=await sendTransactionalEmail(cleanEmail,`Acesso ao Barber Flow`,invitationEmail(name,invitationUrl,role==="ADMIN"?"painel administrativo":"sistema Barber Flow"));
    return NextResponse.json({ok:true,message:delivery.sent?`Convite enviado para ${cleanEmail}.`:`Usuário criado. O e-mail não foi enviado; configure o provedor para encaminhar o convite.`,invitationUrl,emailSent:delivery.sent},{status:201});
  }catch(error){console.error("master user create failed",error);return fail("Não foi possível criar o acesso. Verifique se o e-mail já existe.",409);}
}
