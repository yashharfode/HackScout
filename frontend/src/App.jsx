import { useState, useRef, useEffect } from 'react';
import { 
  Search, BrainCircuit, Globe, Loader2, CheckCircle2, ChevronRight, 
  ExternalLink, Calendar, MapPin, Trophy, Sparkles, Filter, ShieldCheck, 
  Layers, RefreshCw, Terminal, AlertTriangle, Building2, Tag
} from 'lucide-react';

function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [logs, setLogs] = useState([]);
  const [session, setSession] = useState(null);
  const [intent, setIntent] = useState(null);
  const [results, setResults] = useState(null);
  const [stats, setStats] = useState({ devpost: 0, mlh: 0, duplicates: 0 });
  const [error, setError] = useState(null);
  
  // Interactive UI Filters
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [sortByPrize, setSortByPrize] = useState('none');

  const logsEndRef = useRef(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleSearch = async (e, targetQuery = query) => {
    if (e) e.preventDefault();
    if (!targetQuery.trim() || isSearching) return;
    
    setQuery(targetQuery);
    setIsSearching(true);
    setLogs([]);
    setSession(null);
    setIntent(null);
    setResults(null);
    setStats({ devpost: 0, mlh: 0, duplicates: 0 });
    setError(null);
    setSelectedPlatform('all');
    setSelectedLocation('all');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetQuery })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to start search");
      }
      
      const jobId = data.jobId;
      let lastProgressIndex = 0;

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/search/status/${jobId}`);
          
          if (!statusRes.ok) {
             if (statusRes.status === 404) {
               clearInterval(pollInterval);
               setError("Job not found or expired.");
               setIsSearching(false);
             }
             return;
          }
          
          const statusData = await statusRes.json();
          
          for (let i = lastProgressIndex; i < statusData.progress.length; i++) {
            const ev = statusData.progress[i];
            
            if (ev.type === 'connected') {
              setLogs(prev => [...prev, "⚡ Connected to HackScout Agent stream"]);
            } else if (ev.type === 'session_start') {
              setSession(ev.sessionId);
            } else if (ev.type === 'intent_start') {
              setLogs(prev => [...prev, ev.message]);
            } else if (ev.type === 'intent_completed') {
              setIntent(ev.intent);
              setLogs(prev => [...prev, "✓ Intent parsing completed"]);
            } else if (ev.type.endsWith('_start') && ev.type !== 'deduplication_start' && ev.type !== 'filtering_start' && ev.type !== 'session_start') {
              setLogs(prev => [...prev, ev.message]);
            } else if (ev.type.endsWith('_completed') && ev.type !== 'intent_completed' && ev.type !== 'deduplication_completed' && ev.type !== 'filtering_completed') {
              setStats(prev => ({ ...prev, [ev.site.toLowerCase()]: ev.count }));
              setLogs(prev => [...prev, `✓ ${ev.site} search completed (${ev.count} found)`]);
            } else if (ev.type.endsWith('_error')) {
              setLogs(prev => [...prev, `⚠️ ${ev.site} search failed`]);
            } else if (ev.type === 'deduplication_start') {
              setLogs(prev => [...prev, ev.message]);
            } else if (ev.type === 'deduplication_completed') {
              setStats(prev => ({ ...prev, duplicates: ev.count }));
              setLogs(prev => [...prev, `✓ Deduplication completed (${ev.count} merged)`]);
            } else if (ev.type === 'filtering_start') {
              setLogs(prev => [...prev, ev.message]);
            } else if (ev.type === 'filtering_completed') {
              setLogs(prev => [...prev, `✓ Filtering completed (${ev.count} matched)`]);
            }
          }
          
          lastProgressIndex = statusData.progress.length;
          
          if (statusData.status === 'complete') {
            clearInterval(pollInterval);
            setResults(statusData.result);
            setIsSearching(false);
          } else if (statusData.status === 'error') {
            clearInterval(pollInterval);
            setError(statusData.error || "An unexpected error occurred.");
            setIsSearching(false);
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
        }
      }, 1000);
      
    } catch (err) {
      setError(err.message || "Network error occurred.");
      setIsSearching(false);
    }
  };

  // Filtered and sorted display results
  let displayedHackathons = results?.results ? results.results.filter(h => {
    if (selectedPlatform !== 'all' && h.platform.toLowerCase() !== selectedPlatform.toLowerCase()) return false;
    if (selectedLocation === 'online' && !h.location.toLowerCase().includes('online')) return false;
    if (selectedLocation === 'in-person' && h.location.toLowerCase().includes('online') && h.location.toLowerCase() === 'online') return false;
    return true;
  }) : [];

  if (sortByPrize !== 'none') {
    displayedHackathons.sort((a, b) => {
      const parsePrize = (str) => {
        if (!str || str.toLowerCase() === 'see website') return 0;
        const num = parseFloat(str.replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return 0;
        let multiplier = 1;
        if (/k/i.test(str)) multiplier = 1000;
        if (/m/i.test(str)) multiplier = 1000000;
        return num * multiplier;
      };
      
      const pA = parsePrize(a.prize);
      const pB = parsePrize(b.prize);
      
      return sortByPrize === 'high-low' ? pB - pA : pA - pB;
    });
  }

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Subtle Glow Backdrop Effects */}
      <div className="animate-float fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-blue-600/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="animate-float-delayed fixed top-1/3 right-10 w-[400px] h-[300px] bg-purple-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="relative max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8">
        
        {/* Top Navbar */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30 shadow-lg shadow-blue-500/5">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  HACKSCOUT
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE AGENT
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">Autonomous Web Browser Hackathon Research Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Session: <span className="text-blue-300 font-semibold">{session}</span>
              </div>
            )}
            <div className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 font-mono">
              webcmd + GPT-OSS
            </div>
          </div>
        </header>

        {/* Hero & Search Section */}
        <section className="space-y-4">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              Discover Live Hackathons in Seconds
            </h2>
            <p className="text-slate-400 text-sm">
              Natural language queries translated into real-time Chromium web navigation across Devpost & MLH.
            </p>
          </div>

          <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <BrainCircuit className="h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
            </div>
            
            <input
              type="text"
              className="block w-full pl-14 pr-36 py-4 bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 hover:border-slate-600 focus:border-blue-500/80 rounded-2xl text-base md:text-lg text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 shadow-2xl transition-all placeholder:text-slate-500"
              placeholder="e.g. Find Google AI hackathons in India with prizes above $1000..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isSearching}
            />

            <button 
              type="submit"
              disabled={isSearching || !query.trim()}
              className="absolute inset-y-2 right-2 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 animate-gradient-x hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="hidden sm:inline">Scouting...</span>
                </>
              ) : (
                <>
                  <span>Scout Live</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Prompts */}
          {!isSearching && !results && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
              <span className="text-slate-500 font-medium">Quick Prompts:</span>
              {[
                { label: "🏢 Google Hackathons", q: "Find hackathons by Google" },
                { label: "🤖 AI in India", q: "Find AI hackathons in India" },
                { label: "💰 Prize > $10,000", q: "Find hackathons with prize above $10000" },
                { label: "🌐 Online Web3", q: "Find online Web3 hackathons" }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(null, item.q)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all font-medium"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Live Execution Grid (Appears during/after search) */}
        {(isSearching || intent || Object.values(stats).some(v => v > 0) || logs.length > 0) && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Terminal Live Log */}
            <div className="glass-panel rounded-2xl p-5 flex font-mono text-xs flex flex-col h-56">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 text-slate-400">
                <span className="flex items-center gap-2 font-semibold text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  AGENT EXECUTION LOG
                </span>
                {isSearching && (
                  <span className="flex items-center gap-1.5 text-blue-400 text-[10px] animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> ACTIVE
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-slate-300 animate-log-entry" style={{ animationDelay: `${i * 30}ms` }}>
                    <span className="text-blue-500 font-bold select-none">›</span>
                    <span className="leading-relaxed">{log}</span>
                  </div>
                ))}
                {isSearching && (
                  <div className="flex items-center gap-2 text-slate-500 italic pt-1 animate-log-entry" style={{ animationDelay: `${logs.length * 30}ms` }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                    Executing webcmd browser runtime step...
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Understood Intent (LLM Schema) */}
            <div className="glass-panel rounded-2xl p-5 flex flex flex-col h-56">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                <span className="flex items-center gap-2 text-xs font-semibold text-blue-400 tracking-wider uppercase">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  UNDERSTOOD REQUEST
                </span>
                <span className="text-[10px] text-slate-500 font-mono">GPT-OSS 20B</span>
              </div>

              {intent ? (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                  {intent.organization && (
                    <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <span className="text-purple-300 font-medium">Organization</span>
                      <span className="font-bold text-purple-200">{intent.organization}</span>
                    </div>
                  )}
                  {intent.topic && (
                    <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <span className="text-blue-300 font-medium">Topic</span>
                      <span className="font-bold text-blue-200">{intent.topic}</span>
                    </div>
                  )}
                  {intent.location_type && intent.location_type !== "any" && (
                    <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-slate-800 border border-slate-700">
                      <span className="text-slate-400">Location Type</span>
                      <span className="font-semibold text-slate-200 capitalize">{intent.location_type}</span>
                    </div>
                  )}
                  {intent.skill_level && intent.skill_level !== "any" && (
                    <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      <span className="text-indigo-300 font-medium">Skill Level</span>
                      <span className="font-semibold text-indigo-200 capitalize">{intent.skill_level}</span>
                    </div>
                  )}
                  {intent.city_or_country && (
                    <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-slate-800 border border-slate-700">
                      <span className="text-slate-400">Target Region</span>
                      <span className="font-semibold text-slate-200">{intent.city_or_country}</span>
                    </div>
                  )}
                  {intent.registration_status && intent.registration_status !== "any" && (
                    <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-300 font-medium">Status</span>
                      <span className="font-semibold text-emerald-200 capitalize">{intent.registration_status}</span>
                    </div>
                  )}
                  {intent.minimum_prize_amount > 0 && (
                    <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="text-amber-300 font-medium">Min Prize</span>
                      <span className="font-bold text-amber-200">
                        {intent.minimum_prize_currency || ''} {intent.minimum_prize_amount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {!intent.organization && !intent.topic && intent.location_type === "any" && !intent.city_or_country && intent.registration_status === "any" && intent.minimum_prize_amount === 0 && (
                    <div className="text-slate-500 italic text-center py-6">
                      Broad discovery query (no restrictive constraints)
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic">
                  Parsing query constraints...
                </div>
              )}
            </div>

            {/* Live Research Telemetry */}
            <div className="glass-panel rounded-2xl p-5 flex flex flex-col h-56">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                <span className="flex items-center gap-2 text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  LIVE TELEMETRY
                </span>
                <span className="text-[10px] text-slate-500 font-mono">browser bridge</span>
              </div>

              <div className="flex-1 flex flex-col justify-between text-xs space-y-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" /> Devpost Scraped
                    </span>
                    <span className="font-mono font-bold text-blue-300">{stats.devpost} events</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400" /> MLH Scraped
                    </span>
                    <span className="font-mono font-bold text-purple-300">{stats.mlh} events</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Layers className="w-3 h-3 text-orange-400" /> Merged Duplicates
                    </span>
                    <span className="font-mono font-bold text-orange-300">{stats.duplicates}</span>
                  </div>
                </div>

                {results && (
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-semibold text-emerald-400">
                    <span>Verified Matches</span>
                    <span className="font-mono text-sm px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                      {results.count_filtered}
                    </span>
                  </div>
                )}
              </div>
            </div>

          </section>
        )}

        {/* Error Banner */}
        {error && !results && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="font-semibold">Execution Error</p>
              <p className="text-red-400/90 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results Showcase Section */}
        {results && (
          <section className="space-y-6 pt-4">
            
            {/* Results Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Matched Hackathons</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {displayedHackathons.length}
                  </span>
                </h3>
              </div>

              {/* Client-side Controls */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                  <Filter className="w-4 h-4 text-slate-500 ml-2" />
                  <span className="text-slate-400 font-medium text-xs mr-1">Organization/Platform:</span>
                  <select 
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none border border-slate-700 hover:border-slate-600 transition-colors focus:border-blue-500"
                  >
                    {['all', 'devpost', 'mlh', 'devfolio', 'unstop', 'hackerearth', 'hack2skill', 'dorahacks', 'ethglobal', 'taikai', 'lablab.ai', 'hackathon.com', 'luma'].map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 font-medium text-xs ml-2 mr-1">Location:</span>
                  <select 
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none border border-slate-700 hover:border-slate-600 transition-colors focus:border-purple-500"
                  >
                    <option value="all">Any Location</option>
                    <option value="online">Online Only</option>
                    <option value="in-person">In-Person Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 font-medium text-xs ml-2 mr-1">Sort Prize:</span>
                  <select 
                    value={sortByPrize}
                    onChange={(e) => setSortByPrize(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none border border-slate-700 hover:border-slate-600 transition-colors focus:border-emerald-500"
                  >
                    <option value="none">Default</option>
                    <option value="high-low">Highest to Lowest</option>
                    <option value="low-high">Lowest to Highest</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results Cards Grid */}
            {!isSearching && results?.platform_status && Object.values(results.platform_status).includes('error') && !error && (
              <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <span>
                  {Object.entries(results.platform_status).filter(([_, s]) => s === 'error').map(([p]) => p).join(' and ')} unavailable — displaying results from remaining platforms.
                </span>
              </div>
            )}
            
            {displayedHackathons.length === 0 ? (
              <div className="text-center py-16 px-4 glass-panel rounded-3xl border border-slate-800/80 space-y-3 animate-fade-in-up">
                <ShieldCheck className="w-10 h-10 text-slate-500 mx-auto animate-float" />
                <h4 className="text-base font-semibold text-slate-300">Search completed — no matching hackathons found.</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Either no live events matched your strict constraints, or all extracted candidates were rejected by the organization/prize/location filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {displayedHackathons.map((hackathon, idx) => (
                  <div 
                    key={idx}
                    className="group glass-card hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-300 rounded-2xl p-6 shadow-xl hover:shadow-blue-900/20 flex flex-col justify-between relative overflow-hidden animate-fade-in-up hover:-translate-y-1"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1.5 opacity-80 group-hover:opacity-100 transition-opacity ${
                      hackathon.platform === 'Devpost' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 
                      hackathon.platform === 'MLH' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                      hackathon.platform === 'Devfolio' ? 'bg-gradient-to-r from-blue-400 to-indigo-600' :
                      'bg-gradient-to-r from-emerald-400 to-teal-500'
                    }`} />

                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h4 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors leading-snug">
                          {hackathon.name}
                        </h4>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border shrink-0 font-mono shadow-sm ${
                          hackathon.platform === 'Devpost' 
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                            : hackathon.platform === 'MLH'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {hackathon.platform}
                        </span>
                      </div>

                      {/* Organizer Tag if available */}
                      {hackathon.organization && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-4">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Hosted by <strong className="text-indigo-200">{hackathon.organization}</strong></span>
                        </div>
                      )}

                      {/* Event Metadata Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 my-4 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
                        <div className="flex items-center gap-2 truncate">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{hackathon.date}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate font-medium">{hackathon.location}</span>
                        </div>

                        <div className="flex items-center gap-2 truncate">
                          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate font-semibold text-amber-300">{hackathon.prize}</span>
                        </div>

                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            hackathon.registration_status.toLowerCase().includes('ended') || hackathon.registration_status.toLowerCase().includes('closed')
                              ? 'bg-slate-500'
                              : 'bg-emerald-400 animate-pulse'
                          }`} />
                          <span className="truncate font-medium text-slate-300">{hackathon.registration_status}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Tags & CTA */}
                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3 mt-2">
                      <div className="flex flex-wrap gap-1.5 overflow-hidden">
                        {hackathon.tags?.slice(0, 3).map((tag, tIdx) => (
                          <span key={tIdx} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/50">
                            <Tag className="w-2.5 h-2.5 opacity-60" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      <a 
                        href={hackathon.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-semibold transition-all shrink-0 group/link"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </section>
        )}

      </div>
    </div>
  );
}

export default App;
