"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RichTextEditor } from "@/components/rich-text-editor"
import { toast } from "sonner"
import { Mail, Send, FileCode, Eye, X } from "lucide-react"
import { getBroadcastOptionsAction, sendBroadcastAction } from "@/app/actions/broadcasts"

type Option = { key: string; name: string }

// Pasted source of a full email template (not formatted text from a web page).
const looksLikeHtmlTemplate = (text: string) => /<(!doctype|html|head|body|table|style)[\s>]/i.test(text)

const field = "bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"

export default function BroadcastsPage() {
  const [audiences, setAudiences] = useState<Option[]>([])
  const [topics, setTopics] = useState<Option[]>([])
  const [subject, setSubject] = useState("")
  const [previewText, setPreviewText] = useState("")
  const [html, setHtml] = useState("")
  const [templateHtml, setTemplateHtml] = useState<string | null>(null)
  const [audience, setAudience] = useState("allCustomers")
  const [topic, setTopic] = useState("offers")
  const [scheduledAt, setScheduledAt] = useState("")
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getBroadcastOptionsAction().then((res) => {
      if ("error" in res && res.error) return toast.error(res.error)
      if ("audiences" in res) {
        setAudiences(res.audiences ?? [])
        setTopics(res.topics ?? [])
      }
    })
  }, [])

  const useTemplate = (source: string) => {
    setTemplateHtml(source)
    // Prefill the subject from the template's <title> when it's still empty.
    const title = source.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
    if (title && !subject.trim()) setSubject(title.slice(0, 150))
    toast.success("HTML template detected. The preview shows how it will look.")
  }

  const onPasteCapture = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain")
    if (text && looksLikeHtmlTemplate(text)) {
      e.preventDefault()
      e.stopPropagation()
      useTemplate(text)
    }
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > 500_000) return toast.error("HTML file is too large (max 500 KB).")
    useTemplate(await file.text())
  }

  const send = async () => {
    const who = audiences.find((a) => a.key === audience)?.name || audience
    if (!window.confirm(`Send "${subject}" to ${who}? This cannot be undone.`)) return
    setSending(true)
    try {
      const res = await sendBroadcastAction({
        subject,
        previewText,
        html: templateHtml ?? html,
        isTemplate: templateHtml !== null,
        audience: audience as any,
        topic: topic as any,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      if (res.error) return toast.error(res.error)
      toast.success(res.scheduled ? "Broadcast scheduled" : "Broadcast is sending")
      setSubject("")
      setPreviewText("")
      setHtml("")
      setTemplateHtml(null)
      setScheduledAt("")
    } finally {
      setSending(false)
    }
  }

  const hasBody = templateHtml !== null ? templateHtml.trim().length > 0 : html.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Email Broadcasts</h1>
        <p className="text-[#4B5563]">Email your customers through Resend. Every email includes an unsubscribe link for its topic.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937] flex items-center gap-2">
              <Mail className="h-5 w-5" />
              New broadcast
            </CardTitle>
            <CardDescription className="text-[#92400E]">
              Customers who unsubscribed from the chosen topic are skipped automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bc-audience" className="text-[#1F2937]">Audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger id="bc-audience" className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {audiences.map((a) => <SelectItem key={a.key} value={a.key}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bc-topic" className="text-[#1F2937]">Topic</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger id="bc-topic" className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {topics.map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bc-subject" className="text-[#1F2937]">Subject</Label>
              <Input id="bc-subject" className={field} value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. 20% off Steam gift cards this weekend" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bc-preview" className="text-[#1F2937]">Preview text (optional)</Label>
              <Input id="bc-preview" className={field} value={previewText} maxLength={150} onChange={(e) => setPreviewText(e.target.value)} placeholder="Shown next to the subject in the inbox" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="bc-body" className="text-[#1F2937]">Message</Label>
                {templateHtml === null ? (
                  <Button type="button" variant="outline" size="sm" className="border-[#F59E0B]/40 text-[#92400E] hover:bg-[#F59E0B]/10" onClick={() => fileRef.current?.click()}>
                    <FileCode className="h-4 w-4 mr-1.5" /> Use HTML file
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="border-[#F59E0B]/40 text-[#92400E] hover:bg-[#F59E0B]/10" onClick={() => setTemplateHtml(null)}>
                    <X className="h-4 w-4 mr-1.5" /> Remove template
                  </Button>
                )}
                <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={onFile} />
              </div>
              {templateHtml === null ? (
                <div onPasteCapture={onPasteCapture} className="rounded-md border-2 border-[#F59E0B]/30 bg-white">
                  <RichTextEditor id="bc-body" value={html} onChange={setHtml} placeholder="Write your announcement, or paste a full HTML email template…" />
                </div>
              ) : (
                <p className="rounded-md border-2 border-[#F59E0B]/30 bg-white px-3 py-2 text-sm text-[#4B5563]">
                  Using a custom HTML template ({Math.round(templateHtml.length / 1024)} KB). An unsubscribe link is added if it doesn&apos;t have one.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bc-schedule" className="text-[#1F2937]">Schedule (optional, your local time)</Label>
              <Input id="bc-schedule" type="datetime-local" className={field} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <Button onClick={send} disabled={sending || subject.trim().length < 3 || !hasBody} className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white">
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending…" : scheduledAt ? "Schedule broadcast" : "Send broadcast"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937] flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview
            </CardTitle>
            <CardDescription className="text-[#92400E]">
              {templateHtml !== null ? "Your HTML template as recipients will see it." : "Message body; the store's email layout is added when sent."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* sandbox="" blocks scripts and navigation inside the previewed HTML. */}
            <iframe
              title="Broadcast preview"
              sandbox=""
              srcDoc={templateHtml ?? `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;padding:16px">${html || '<p style="color:#9ca3af">Nothing to preview yet.</p>'}</div>`}
              className="w-full h-[560px] rounded-lg border border-[#F59E0B]/30 bg-white"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
