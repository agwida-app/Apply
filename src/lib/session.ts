import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const COOKIE = "radd_session";
type Session = { role: "client"; userId: string } | { role: "admin" };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 chars");
  return new TextEncoder().encode(s);
}

export async function setSession(s: Session) {
  const token = await new SignJWT(s as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const s = await getSession();
  if (!s || s.role !== "client") redirect("/login");
  const user = await db.user.findUnique({ where: { id: s.userId } });
  if (!user) redirect("/login");
  if (user.status === "suspended") redirect("/login?error=suspended");
  return user;
}

export async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") redirect("/admin/login");
}
