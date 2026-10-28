import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
function isPublicHostname(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) {
    const p = h.split(".").map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] >= 224 ||
        (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
        (p[0] === 192 && p[1] === 168)) return false;
  }
  return h.includes(".") && !h.startsWith("-");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return reply({ error: "Supabase function is not configured." }, 500);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "Authentication required." }, 401);
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return reply({ error: "Invalid session." }, 401);
  let input: { url?: string; goal?: string; sector?: string };
  try { input = await req.json(); } catch { return reply({ error: "Invalid JSON." }, 400); }
  let url: URL;
  try { url = new URL(input.url || ""); } catch { return reply({ error: "Enter a valid public website URL." }, 400); }
  if (!["http:", "https:"].includes(url.protocol) || !isPublicHostname(url.hostname) || url.username || url.password) {
    return reply({ error: "Only public HTTP(S) websites are allowed." }, 400);
  }
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) return reply({ error: "Set OPENAI_API_KEY as a Supabase secret before using AI analysis." }, 503);
  let pageText = "";
  try {
    const response = await fetch(url.toString(), { redirect: "manual", signal: AbortSignal.timeout(9000), headers: { "User-Agent": "PipelinePilotResearch/1.0 (+website analysis)" } });
    if (response.status >= 300 && response.status < 400) return reply({ error: "Website redirected. Enter its final public URL." }, 400);
    if (!response.ok) return reply({ error: "Website could not be fetched (HTTP " + response.status + ")." }, 422);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return reply({ error: "The URL does not return a readable HTML page." }, 422);
    const raw = await response.text();
    pageText = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").slice(0, 12000);
  } catch { return reply({ error: "Could not read this website within the time limit." }, 422); }
  let searchResults: Array<{ title: string; url: string; content: string }> = [];
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (tavilyKey) {
    try {
      const searchResponse = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavilyKey, query: [url.hostname, input.sector || "", input.goal || "entreprise services actualités"].filter(Boolean).join(" "), search_depth: "basic", max_results: 5, include_answer: false }),
        signal: AbortSignal.timeout(10000),
      });
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        searchResults = (searchData.results || []).map((item: any) => ({ title: String(item.title || "").slice(0, 200), url: String(item.url || ""), content: String(item.content || "").slice(0, 600) }));
      }
    } catch { /* Website analysis remains available if search is temporarily unavailable. */ }
  }
  const prompt = [
    "Tu es un assistant de recherche B2B. Analyse le contenu public fourni; ne prétends pas avoir vérifié des faits qui n'y figurent pas.",
    "Réponds uniquement en JSON valide avec les clés: company_guess, summary, sector, potential_needs (array), verified_signals (array), suggested_offer, outreach_angle, confidence (low|medium|high), caveats (array).",
    "Distingue explicitement les observations visibles des hypothèses. Pas de données personnelles sensibles ni de coordonnées inventées.",
    "Objectif de prospection: " + (input.goal || "identifier une offre pertinente"),
    "Secteur cible: " + (input.sector || "à déterminer"),
    "URL: " + url.toString(),
    "Contenu extrait: " + pageText,
    "Résultats de recherche web (si disponibles, traite-les comme des indices et cite les URL exactes): " + JSON.stringify(searchResults),
  ].join("\n\n");
  try {
    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + openAiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini", temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Tu produis des analyses B2B prudentes, utiles et vérifiables en français." }, { role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!ai.ok) return reply({ error: "AI provider error (" + ai.status + "). Check your API billing and key." }, 502);
    const payload = await ai.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return reply({ error: "The AI provider returned an empty response." }, 502);
    return reply({ url: url.toString(), analysis: JSON.parse(content), research_sources: searchResults.map((item) => ({ title: item.title, url: item.url, excerpt: item.content })), source: { type: "public_website", fetched_at: new Date().toISOString(), characters_analyzed: pageText.length, web_search_enabled: Boolean(tavilyKey) } });
  } catch { return reply({ error: "AI analysis failed or timed out." }, 502); }
});
