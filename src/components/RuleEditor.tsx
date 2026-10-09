"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { fetchPosts, findPost, saveRule, type RuleInput } from "@/app/dashboard/actions";
import type { Post } from "@/lib/meta";
import { PlatformIcon } from "./ui";

type PageOpt = { id: string; name: string; platform: string };

const REPLY_TEMPLATES = [
  "شكراً على تعليقك {name} 🌷 أرسلنا لك التفاصيل على الخاص",
  "أهلاً {name}! تفقّد رسائلك الخاصة 📩",
  "تم الرد عليك في الخاص ✅",
  "شكراً لتفاعلك، سنرد عليك حالاً 🙏",
];
const DM_TEMPLATES = [
  "أهلاً {name} 👋 شكراً لاهتمامك! السعر: ___ والتوصيل متاح لكل المدن. للطلب أرسل الاسم والعنوان ورقم الهاتف.",
  "مرحباً {name}! هذا رابط الكتالوج الكامل: ___ \nلأي استفسار نحن هنا 🌷",
  "شكراً لتعليقك {name} 🎁 تم تسجيل مشاركتك في المسابقة. سنعلن الفائز قريباً!",
];
const DELAYS = [[0, "فوراً"], [15, "15 ثانية"], [60, "دقيقة"], [180, "3 دقائق"], [600, "10 دقائق"]] as const;

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center gap-3 text-sm font-bold">
      <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "right-[1.375rem]"}`} />
      </span>
      {label}
    </button>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-4 flex items-center gap-2 font-extrabold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-sm text-white">{n}</span>{title}
      </h2>
      {children}
    </section>
  );
}

export function RuleEditor({ pages, initial }: { pages: PageOpt[]; initial?: RuleInput & { id: string; pageName: string; platform: string } }) {
  const router = useRouter();
  const editing = !!initial;
  const [pageId, setPageId] = useState(initial?.pageId ?? pages[0]?.id ?? "");
  const [mode, setMode] = useState<"list" | "url">("list");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [postsErr, setPostsErr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [post, setPost] = useState<Post | null>(initial ? { id: initial.postId, text: initial.postPreview ?? "", image: initial.postImage ?? null, permalink: initial.postUrl ?? null, createdAt: "" } : null);
  const [name, setName] = useState(initial?.name ?? "");
  const [publicReply, setPublicReply] = useState(initial?.publicReply ?? true);
  const [variants, setVariants] = useState<string[]>(initial?.replyVariants.length ? initial.replyVariants : [REPLY_TEMPLATES[0]]);
  const [privateReply, setPrivateReply] = useState(initial?.privateReply ?? true);
  const [dm, setDm] = useState(initial?.dmMessage ?? "");
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join("، "));
  const [oncePerUser, setOncePerUser] = useState(initial?.oncePerUser ?? true);
  const [delay, setDelay] = useState(initial?.delaySeconds ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [searching, startSearch] = useTransition();

  const platform = pages.find((p) => p.id === pageId)?.platform ?? initial?.platform ?? "facebook";

  useEffect(() => {
    if (editing || !pageId) return;
    setPosts(null); setPostsErr(null); setPost(null);
    fetchPosts(pageId).then((r) => (r.error ? setPostsErr(r.error) : setPosts(r.posts ?? [])));
  }, [pageId, editing]);

  const search = () => startSearch(async () => {
    setPostsErr(null);
    const r = await findPost(pageId, url);
    if (r.post) setPost(r.post); else setPostsErr(r.error ?? "غير موجود");
  });

  const submit = () => start(async () => {
    setError(null);
    if (!post) return setError("اختر المنشور أولاً.");
    const kw = keywords.split(/[,،\n]/).map((k) => k.trim()).filter(Boolean);
    const r = await saveRule({
      id: initial?.id, pageId, postId: post.id, postUrl: post.permalink, postPreview: post.text, postImage: post.image,
      name, publicReply, replyVariants: variants, privateReply, dmMessage: dm, keywords: kw, oncePerUser, delaySeconds: delay,
    });
    if (r.error) { setError(r.error); if (r.id) router.push(`/dashboard/rules/${r.id}`); return; }
    router.push(`/dashboard/rules/${r.id}?saved=1`);
    router.refresh();
  });

  const sample = (s: string) => s.replace(/\{name\}|\{الاسم\}/g, "سارة");
  const firstVariant = variants.find((v) => v.trim());

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Section n={1} title="اختر الحساب والمنشور">
          {editing ? (
            <div className="flex items-center gap-2 text-sm font-bold"><PlatformIcon platform={platform} /> {initial!.pageName}</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {pages.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPageId(p.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${p.id === pageId ? "border-brand-600 ring-2 ring-brand-200 dark:ring-brand-800" : ""}`}
                    style={p.id === pageId ? undefined : { borderColor: "var(--border)" }}>
                    <PlatformIcon platform={p.platform} /> {p.name}
                  </button>
                ))}
              </div>
              <div className="mt-4 inline-flex rounded-xl p-1" style={{ background: "var(--surface-2)" }}>
                {(["list", "url"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-bold ${mode === m ? "bg-[var(--surface)] shadow" : "muted"}`}>
                    {m === "list" ? "اختيار من المنشورات" : "عن طريق الرابط"}
                  </button>
                ))}
              </div>
              {postsErr && <p className="mt-3 text-sm text-red-600">{postsErr}</p>}
              {mode === "url" ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input className="input" dir="ltr" placeholder="https://facebook.com/.../posts/..." value={url} onChange={(e) => setUrl(e.target.value)} />
                  <button type="button" onClick={search} disabled={!url || searching} className="btn-primary shrink-0">{searching ? "جارٍ البحث…" : "بحث"}</button>
                </div>
              ) : (
                <div className="mt-3 grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
                  {posts === null && !postsErr && <p className="muted text-sm">جارٍ تحميل المنشورات…</p>}
                  {posts?.length === 0 && <p className="muted text-sm">لا توجد منشورات.</p>}
                  {posts?.map((p) => (
                    <button key={p.id} type="button" onClick={() => setPost(p)}
                      className={`flex gap-3 rounded-xl border p-2 text-start text-sm ${post?.id === p.id ? "border-brand-600 ring-2 ring-brand-200 dark:ring-brand-800" : ""}`}
                      style={post?.id === p.id ? undefined : { borderColor: "var(--border)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image ? <img src={p.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg text-2xl" style={{ background: "var(--surface-2)" }}>📝</span>}
                      <span className="line-clamp-3">{p.text || "(بدون نص)"}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {post && (
            <div className="mt-4 rounded-xl border-2 border-dashed border-brand-300 p-3 text-sm dark:border-brand-700">
              <div className="mb-1 text-xs font-bold text-brand-600">✓ المنشور المختار</div>
              <div className="line-clamp-3">{post.text || "(بدون نص)"}</div>
              {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="faint text-xs underline" dir="ltr">{post.permalink}</a>}
            </div>
          )}
          <div className="mt-4">
            <label className="label">اسم داخلي (اختياري)</label>
            <input className="input" placeholder="مثال: عرض الفساتين - رمضان" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </Section>

        <Section n={2} title="الرد العلني على التعليق">
          <Toggle on={publicReply} onChange={setPublicReply} label="الرد على التعليق في المنشور" />
          {publicReply && (
            <div className="mt-4 space-y-2">
              <p className="faint text-xs">أضف أكثر من صيغة ليختار النظام إحداها عشوائياً (يبدو الرد طبيعياً ويقلل احتمال اعتباره سبام). استخدم <b>{"{name}"}</b> لاسم الزبون.</p>
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <textarea rows={2} className="input" value={v} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? e.target.value : x)))} />
                  {variants.length > 1 && <button type="button" aria-label="حذف" onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="btn-ghost px-3">✕</button>}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {variants.length < 10 && <button type="button" onClick={() => setVariants([...variants, ""])} className="btn-ghost py-1.5 text-xs">+ صيغة أخرى</button>}
                {REPLY_TEMPLATES.filter((t) => !variants.includes(t)).slice(0, 3).map((t) => (
                  <button key={t} type="button" onClick={() => setVariants([...variants.filter((v) => v.trim()), t])} className="faint rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--border)" }}>+ {sample(t).slice(0, 30)}…</button>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section n={3} title="الرسالة الخاصة (تصل لبريد الرسائل)">
          <Toggle on={privateReply} onChange={setPrivateReply} label={platform === "instagram" ? "إرسال رسالة في Direct" : "إرسال رسالة في ماسنجر"} />
          {privateReply && (
            <div className="mt-4 space-y-2">
              <textarea rows={5} className="input" placeholder="اكتب الرسالة التي ستصل للزبون…" value={dm} onChange={(e) => setDm(e.target.value)} />
              <div className="faint flex justify-between text-xs"><span>يمكن استخدام {"{name}"}</span><span>{dm.length}/2000</span></div>
              <div className="flex flex-wrap gap-2">
                {DM_TEMPLATES.map((t) => (
                  <button key={t} type="button" onClick={() => setDm(t)} className="faint rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--border)" }}>قالب: {t.slice(0, 25)}…</button>
                ))}
              </div>
              <p className="faint text-xs">ℹ️ يسمح فيسبوك برسالة خاصة واحدة فقط لكل تعليق، وخلال 7 أيام من التعليق.</p>
            </div>
          )}
        </Section>

        <Section n={4} title="خيارات متقدمة">
          <div className="space-y-5">
            <div>
              <label className="label">الرد فقط إذا احتوى التعليق على (اختياري)</label>
              <input className="input" placeholder="مثال: السعر، بكم، تم، التفاصيل" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
              <p className="faint mt-1 text-xs">افصل بفاصلة. اتركه فارغاً للرد على كل التعليقات. المطابقة لا تتأثر بالتشكيل أو الهمزات.</p>
            </div>
            <Toggle on={oncePerUser} onChange={setOncePerUser} label="الرد مرة واحدة فقط لكل شخص على هذا المنشور" />
            <div>
              <label className="label">تأخير الرد</label>
              <div className="flex flex-wrap gap-2">
                {DELAYS.map(([s, l]) => (
                  <button key={s} type="button" onClick={() => setDelay(s)}
                    className={`rounded-xl border px-3 py-1.5 text-sm font-bold ${delay === s ? "border-brand-600 bg-brand-600 text-white" : ""}`}
                    style={delay === s ? undefined : { borderColor: "var(--border)" }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* المعاينة */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="card">
          <div className="mb-4 font-extrabold">👁 معاينة</div>
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-300 dark:bg-slate-600">👩</span>
              <div className="rounded-2xl px-3 py-2" style={{ background: "var(--surface-2)" }}><b>سارة أحمد</b><div>{keywords.split(/[,،]/)[0]?.trim() || "كم السعر؟"}</div></div>
            </div>
            {publicReply && firstVariant && (
              <div className="flex gap-2 ps-8">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs text-white">ص</span>
                <div className="rounded-2xl px-3 py-2" style={{ background: "var(--surface-2)" }}><b>صفحتك</b><div className="whitespace-pre-wrap">{sample(firstVariant)}</div></div>
              </div>
            )}
            {privateReply && dm.trim() && (
              <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div className="faint mb-2 text-xs">📩 في {platform === "instagram" ? "Direct" : "ماسنجر"}</div>
                <div className="me-6 whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-white">{sample(dm)}</div>
              </div>
            )}
          </div>
          {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
          <button type="button" onClick={submit} disabled={pending || !post} className="btn-primary mt-5 w-full py-3">
            {pending ? "جارٍ الحفظ…" : editing ? "حفظ التعديلات" : "تفعيل الرد التلقائي ⚡"}
          </button>
        </div>
      </div>
    </div>
  );
}
