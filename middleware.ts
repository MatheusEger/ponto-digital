// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'chave-secreta-padrao-aqui');

  // 1. Proteção das rotas do Administrador
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next();
    
    // CORRIGIDO: O nome do cookie que a sua API gera é 'pd_admin'
    const token = req.cookies.get('pd_admin')?.value; 
    
    if (!token) return NextResponse.redirect(new URL('/admin/login', req.url));
    try {
      await jwtVerify(token, secret);
    } catch {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  // 2. Proteção do Portal do Funcionário
  if (pathname.startsWith('/portal/dashboard')) {
    const token = req.cookies.get('portal_token')?.value;
    if (!token) return NextResponse.redirect(new URL('/portal/login', req.url));
    try {
      await jwtVerify(token, secret);
    } catch {
      return NextResponse.redirect(new URL('/portal/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/portal/dashboard/:path*']
};