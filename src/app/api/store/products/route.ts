import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getBookingDb, getPublicUnit } from "@/lib/booking";

const fail=(error:string,status:number)=>NextResponse.json({error},{status});

export async function GET(request:Request){
  const auth=await getAuth();
  const session=await auth.api.getSession({headers:request.headers});
  if(!session)return fail("Entre na sua conta para acessar a loja.",401);
  if(session.user.role!=="CLIENT")return fail("A loja está disponível para contas de cliente.",403);
  const slug=new URL(request.url).searchParams.get("shop");
  const db=getBookingDb();
  const unit=await getPublicUnit(db,slug);
  if(!unit)return fail("Nenhuma loja ativa foi encontrada.",404);
  try{
    const linked=await db.prepare(`SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id
      WHERE u.auth_subject=? AND u.deleted_at IS NULL AND m.barbershop_id=? AND m.unit_id=? AND m.role='CLIENT' AND m.is_active=1 LIMIT 1`)
      .bind(session.user.id,unit.barbershop_id,unit.unit_id).first();
    if(!linked)return fail("Este cliente ainda não tem vínculo ativo com esta barbearia.",403);
    const [products,shop]=await Promise.all([
      db.prepare(`SELECT id,name,category,image_url,sale_price_cents,stock_quantity FROM products
        WHERE barbershop_id=? AND unit_id=? AND is_active=1 AND is_for_sale=1 AND stock_quantity>0
        ORDER BY category COLLATE NOCASE,name COLLATE NOCASE`).bind(unit.barbershop_id,unit.unit_id).all(),
      db.prepare("SELECT name FROM barbershops WHERE id=?").bind(unit.barbershop_id).first<{name:string}>(),
    ]);
    return NextResponse.json({data:products.results,unit:{name:unit.unit_name,phone:unit.unit_phone,barbershopName:shop?.name??unit.unit_name}});
  }catch(error){
    console.error("store product lookup failed",error);
    return fail("Não foi possível carregar os produtos desta loja.",500);
  }
}
