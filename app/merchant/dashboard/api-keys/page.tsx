"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Copy, KeyRound, Plus, ShieldAlert, Webhook, Send, RotateCw, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useMerchantState } from "@/lib/merchant/context"
import {
  createApiKeyAction,
  getWebhookSettingsAction,
  listApiKeysAction,
  listWebhookDeliveriesAction,
  redeliverWebhookAction,
  revokeApiKeyAction,
  rotateWebhookSecretAction,
  saveWebhookUrlAction,
  sendTestWebhookAction,
  type ApiKeyRow,
  type WebhookDeliveryRow,
} from "@/app/actions/merchant-trade"
import { Pager, usePaged } from "@/components/merchant/pager"
import { amberCard, fmtDateTime, inputCls, PageHeader, primaryBtn, Spinner } from "@/components/merchant/ui"

const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"), () => toast.error("Copy failed"))

function SecretBox({ value, note }: { value: string; note: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border-2 border-[#F59E0B]/30 bg-[#FEF7E0] p-3">
        <code className="font-mono text-xs sm:text-sm break-all flex-1">{value}</code>
        <Button size="icon" variant="ghost" onClick={() => copy(value)} aria-label="Copy"><Copy className="h-4 w-4" /></Button>
      </div>
      <p className="text-xs text-[#92400E] font-semibold">{note}</p>
    </div>
  )
}

function CreateKeyDialog({ canLive, onCreated }: { canLive: boolean; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [ips, setIps] = useState("")
  const [mode, setMode] = useState<"live" | "test">(canLive ? "live" : "test")
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await createApiKeyAction(name, ips, mode)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    setSecret(res.key)
    onCreated()
  }
  const close = (o: boolean) => {
    setOpen(o)
    if (!o) { setSecret(null); setName(""); setIps(""); setMode(canLive ? "live" : "test") }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button size="sm" className={`h-9 ${primaryBtn}`}><Plus className="h-4 w-4 mr-1.5" />Create key</Button>
      </DialogTrigger>
      <DialogContent className="w-[94vw] max-w-lg rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1F2937]">{secret ? "Copy your API key now" : "Create API key"}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-[#4B5563]">{secret ? "Store it in your server's secrets, never in a website or app." : "Use one key per server or environment so you can revoke them separately."}</DialogDescription>
        </DialogHeader>
        {secret ? (
          <div className="space-y-4">
            <SecretBox value={secret} note="This is the only time we'll show this key." />
            <Button className={`w-full h-10 rounded-xl ${primaryBtn}`} onClick={() => close(false)}>I&apos;ve saved it</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["live", "test"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={m === "live" && !canLive}
                  onClick={() => setMode(m)}
                  className={`rounded-xl border-2 p-3 text-left disabled:opacity-50 disabled:cursor-not-allowed ${mode === m ? "border-[#7E3AF2] bg-purple-50" : "border-gray-200 bg-white"}`}
                >
                  <p className="text-sm font-bold text-[#1F2937]">{m === "live" ? "Live key" : "Test key"}</p>
                  <p className="text-xs text-[#6B7280]">{m === "live" ? (canLive ? "Real orders, real codes, charged to your wallet." : "Unlocks after verification.") : "Fake codes, no charge. For building your integration."}</p>
                </button>
              ))}
            </div>
            <div className="space-y-1.5"><Label htmlFor="k-name" className="text-[#1F2937] font-semibold text-sm">Name *</Label><Input id="k-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder={mode === "live" ? "e.g. Production server" : "e.g. Staging"} className={inputCls} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="k-ips" className="text-[#1F2937] font-semibold text-sm">Allowed server IPs (recommended)</Label>
              <Textarea id="k-ips" value={ips} onChange={(e) => setIps(e.target.value)} rows={2} placeholder="203.0.113.10, 203.0.113.11" className={inputCls.replace("h-10", "")} />
              <p className="text-xs text-[#6B7280]">Only these IPs can use the key. Leave empty to allow any IP.</p>
            </div>
            <Button type="submit" disabled={busy} className={`w-full h-11 rounded-xl ${primaryBtn}`}>{busy ? "Creating…" : `Create ${mode} key`}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

const DELIVERY_STYLE: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-900 border-emerald-300",
  pending: "bg-sky-100 text-sky-900 border-sky-300",
  failed: "bg-red-100 text-red-800 border-red-300",
}

function WebhooksCard({ tick, initialSettings }: { tick: number; initialSettings: { url: string | null; hasSecret: boolean; events: readonly string[] } }) {
  const [settings, setSettings] = useState(initialSettings)
  const [url, setUrl] = useState(initialSettings.url || "")
  const [secret, setSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [deliveries, setDeliveries] = useState<{ rows: WebhookDeliveryRow[]; total: number } | null>(null)

  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false)

  const loadDeliveries = () => listWebhookDeliveriesAction(page).then((d) => d && setDeliveries(d))
  useEffect(() => {
    setSettings(initialSettings)
    setUrl((cur) => cur || initialSettings.url || "")
  }, [initialSettings])
  useEffect(() => { loadDeliveries() }, [page, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!settings) return null
  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true)
    try { return await fn() } finally { setBusy(false) }
  }
  const save = () => run(async () => {
    const r = await saveWebhookUrlAction(url)
    if (!r.success) return toast.error(r.error)
    if (r.secret) setSecret(r.secret)
    toast.success(url ? "Webhook endpoint saved" : "Webhooks turned off")
    setSettings({ ...settings, url: url || null, hasSecret: settings.hasSecret || !!r.secret })
  })
  const handleConfirmRotate = async (e: React.MouseEvent) => {
    e.preventDefault()
    run(async () => {
      const r = await rotateWebhookSecretAction()
      if (!r.success) return toast.error(r.error)
      setSecret(r.secret)
      toast.success("New signing secret created")
      setRotateConfirmOpen(false)
    })
  }
  const test = () => run(async () => {
    const r = await sendTestWebhookAction()
    if (!r.success) return toast.error(r.error)
    toast.success("Test event sent")
    setTimeout(loadDeliveries, 1500)
  })
  const retry = (id: string) => run(async () => {
    const r = await redeliverWebhookAction(id)
    if (!r.success) return toast.error(r.error)
    r.delivered ? toast.success("Delivered") : toast.error("Your endpoint still didn't accept it")
    loadDeliveries()
  })

  return (
    <Card className={`${amberCard} overflow-hidden`}>
      <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
        <CardTitle className="text-[#1F2937] text-lg font-bold flex items-center gap-2"><Webhook className="h-5 w-5 text-[#92400E]" />Webhooks</CardTitle>
        <CardDescription className="text-[#92400E]">We POST signed events to your server: {settings.events.join(", ")}. Failed deliveries are retried for about a day.</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-server.com/byiora/webhook" className={`${inputCls} bg-white flex-1`} aria-label="Webhook URL" />
          <Button size="sm" disabled={busy} onClick={save} className={`h-10 ${primaryBtn}`}>Save</Button>
        </div>
        {secret && <SecretBox value={secret} note="Your signing secret. Shown only once: copy it now." />}
        {settings.url && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={test} className="h-9 bg-white"><Send className="h-4 w-4 mr-1.5" />Send test event</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setRotateConfirmOpen(true)} className="h-9 bg-white"><RotateCw className="h-4 w-4 mr-1.5" />New signing secret</Button>
            <p className="text-xs text-[#6B7280]">Verify each request: HMAC-SHA256 of <code className="font-mono">timestamp + &quot;.&quot; + body</code> with your secret must equal the <code className="font-mono">X-Byiora-Signature</code> header (after <code className="font-mono">sha256=</code>).</p>
          </div>
        )}
        <div className="space-y-2">
          <p className="text-sm font-bold text-[#1F2937]">Recent deliveries</p>
          {!deliveries || deliveries.rows.length === 0 ? (
            <p className="text-sm text-[#4B5563] rounded-lg border border-[#F59E0B]/20 bg-white p-4 text-center">No deliveries yet.</p>
          ) : (
            <>
              <div className="rounded-lg border border-[#F59E0B]/20 bg-white divide-y divide-gray-100">
                {deliveries.rows.map((d) => (
                  <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1F2937] font-mono">{d.event}{!d.livemode && <span className="ml-2 text-[11px] font-sans font-semibold text-[#6B7280]">TEST</span>}</p>
                      <p className="text-xs text-[#6B7280]">{fmtDateTime(d.createdAt)} · {d.attempts} attempt{d.attempts === 1 ? "" : "s"}{d.responseStatus ? ` · HTTP ${d.responseStatus}` : ""}{d.lastError && d.status !== "delivered" ? ` · ${d.lastError}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.status !== "delivered" && <Button size="sm" variant="outline" disabled={busy} onClick={() => retry(d.id)} className="h-7 text-xs bg-white"><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>}
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-semibold capitalize ${DELIVERY_STYLE[d.status]}`}>{d.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Pager page={page} total={deliveries.total} onPage={setPage} />
            </>
          )}
        </div>

        <AlertDialog open={rotateConfirmOpen} onOpenChange={(o) => { if (!o && !busy) setRotateConfirmOpen(false) }}>
          <AlertDialogContent className="bg-white border-gray-200 shadow-xl rounded-2xl p-6 sm:max-w-md w-[calc(100%-2rem)] mx-auto">
            <AlertDialogHeader className="space-y-3">
              <AlertDialogTitle className="text-2xl font-bold text-gray-900">Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-500 text-base">
                Create a new signing secret? The old one stops working immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3 sm:space-x-0">
              <AlertDialogCancel
                disabled={busy}
                className="mt-0 h-12 sm:rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 border-none font-semibold transition-colors"
              >
                No, keep it
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                onClick={handleConfirmRotate}
                className="h-12 sm:rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-md"
              >
                {busy ? "Creating…" : "Yes, create new secret"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

export default function MerchantApiKeys() {
  const { state, tick } = useMerchantState()
  const [data, setData] = useState<{ keys: ApiKeyRow[]; rateLimitPerMin: number } | null>(null)
  const [webhookSettings, setWebhookSettings] = useState<{ url: string | null; hasSecret: boolean; events: readonly string[] } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null)
  const [confirmKeyName, setConfirmKeyName] = useState("")
  const [isRevoking, setIsRevoking] = useState(false)

  const load = () => {
    Promise.all([
      listApiKeysAction(),
      getWebhookSettingsAction(),
    ]).then(([keysData, whSettings]) => {
      setData(keysData || { keys: [], rateLimitPerMin: 60 })
      setWebhookSettings(whSettings || { url: null, hasSecret: false, events: [] })
    })
  }
  useEffect(() => { load() }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const keys = usePaged(data?.keys || [])

  if (!data || !webhookSettings) return <Spinner label="Loading API keys and webhooks..." />
  const active = data.keys.filter((k) => !k.revokedAt)

  const handleConfirmRevoke = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    if (!revokeTarget || confirmKeyName.trim() !== revokeTarget.name) return
    setIsRevoking(true)
    const res = await revokeApiKeyAction(revokeTarget.id)
    setIsRevoking(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Key revoked")
    setRevokeTarget(null)
    setConfirmKeyName("")
    load()
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="API Keys" subtitle="Connect your website or app to buy codes automatically.">
        <div className="flex gap-2">
          <a href="/merchant/docs" target="_blank" rel="noopener" className="inline-flex items-center h-9 px-3.5 rounded-md border border-[#F59E0B] text-[#92400E] bg-[#FEF7E0] hover:bg-[#FEF7E0]/80 text-sm font-semibold">API documentation</a>
          <CreateKeyDialog canLive={state.canUse} onCreated={load} />
        </div>
      </PageHeader>
      {!state.canUse && (
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-3.5 text-sm text-purple-900">
          Live keys unlock once your business is verified. You can already create a <span className="font-semibold">test key</span> and build your integration: it returns fake codes and never charges your wallet.
        </div>
      )}

      <Card className={`${amberCard} overflow-hidden`}>
        <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937] text-lg font-bold">Your keys ({active.length} active)</CardTitle>
          <CardDescription className="text-[#92400E]">Limit: {data.rateLimitPerMin} requests per minute across all keys · up to 5 active keys</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-2">
          {data.keys.length === 0 ? (
            <div className="text-center py-10">
              <KeyRound className="h-8 w-8 text-[#F59E0B] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#1F2937]">No API keys yet</p>
              <p className="text-xs text-[#4B5563] mt-1">Create a test key to start building, then a live key when you&apos;re ready.</p>
            </div>
          ) : (
            <>
              {keys.pageItems.map((k) => (
                <div key={k.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-white p-3.5 ${k.revokedAt ? "border-gray-200 opacity-60" : "border-[#F59E0B]/20"}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1F2937] flex items-center gap-2 flex-wrap">
                      {k.name}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${k.mode === "live" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"}`}>{k.mode === "live" ? "Live" : "Test"}</span>
                      {k.revokedAt && <span className="text-xs font-semibold text-red-600">Revoked</span>}
                    </p>
                    <p className="text-xs font-mono text-[#4B5563]">{k.prefix}…</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      Created {fmtDateTime(k.createdAt)} · {k.lastUsedAt ? `Last used ${fmtDateTime(k.lastUsedAt)}` : "Never used"} · {k.ipAllowlist.length ? `IPs: ${k.ipAllowlist.join(", ")}` : "Any IP"}
                    </p>
                  </div>
                  {!k.revokedAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setRevokeTarget(k); setConfirmKeyName("") }}
                      className="h-8 shrink-0 bg-white border-red-300 text-red-700 hover:bg-red-50 font-semibold"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
              <Pager page={keys.page} total={keys.total} onPage={keys.setPage} />
            </>
          )}
          {active.some((k) => k.mode === "live" && !k.ipAllowlist.length) && (
            <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5"><ShieldAlert className="h-4 w-4 shrink-0" />A live key without an IP allowlist works from anywhere if it leaks. Add your server IPs for safety.</p>
          )}
        </CardContent>
      </Card>

      <WebhooksCard tick={tick} initialSettings={webhookSettings} />

      {/* Revoke API Key Alert Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open && !isRevoking) { setRevokeTarget(null); setConfirmKeyName("") } }}>
        <AlertDialogContent className="bg-white border-gray-200 shadow-xl rounded-2xl p-6 sm:max-w-md w-[calc(100%-2rem)] mx-auto">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-2xl font-bold text-gray-900">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 text-base">
              Revoking &quot;{revokeTarget?.name}&quot; will stop anything using it immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-4 space-y-2">
            <label htmlFor="confirm-key-name" className="block text-xs font-medium text-gray-600">
              Please type <span className="font-bold text-gray-900 select-all font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{revokeTarget?.name}</span> to confirm:
            </label>
            <Input
              id="confirm-key-name"
              value={confirmKeyName}
              onChange={(e) => setConfirmKeyName(e.target.value)}
              placeholder={revokeTarget?.name}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20 focus-visible:ring-offset-0 transition-all shadow-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmKeyName.trim() === revokeTarget?.name && !isRevoking) {
                  e.preventDefault()
                  handleConfirmRevoke(e)
                }
              }}
            />
          </div>

          <AlertDialogFooter className="mt-6 gap-3 sm:space-x-0">
            <AlertDialogCancel
              disabled={isRevoking}
              onClick={() => { setRevokeTarget(null); setConfirmKeyName("") }}
              className="mt-0 h-12 sm:rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 border-none font-semibold transition-colors"
            >
              No, keep it
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRevoking || confirmKeyName.trim() !== revokeTarget?.name}
              onClick={handleConfirmRevoke}
              className="h-12 sm:rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all shadow-md"
            >
              {isRevoking ? "Revoking…" : "Yes, revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
