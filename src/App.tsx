/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { 
  Shield, 
  Activity, 
  Cpu, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Globe, 
  Lock,
  Download,
  Terminal,
  BarChart3
} from "lucide-react";
import { useState, useEffect } from "react";

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [simulatedMetrics, setSimulatedMetrics] = useState({
    memory: 245,
    domNodes: 1240,
    requests: 42,
    risk: "Low",
    cpu: 12
  });

  // Simulate real-time updates for the demo
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedMetrics(prev => ({
        ...prev,
        memory: prev.memory + (Math.random() * 4 - 2),
        cpu: Math.max(5, Math.min(40, prev.cpu + (Math.random() * 10 - 5))),
        domNodes: prev.domNodes + (Math.random() > 0.8 ? 1 : 0)
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200 font-sans selection:bg-sky-500/30">
      {/* Navigation */}
      <nav className="border-bottom border-slate-800/50 bg-[#0f1115]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">WebPulse <span className="text-sky-500">Guardian</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#demo" className="hover:text-white transition-colors">Live Demo</a>
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
            <button className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-sky-600/20">
              <Download className="w-4 h-4" />
              Install Extension
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1e293b,transparent)] opacity-50"></div>
        <div className="max-w-7xl mx-auto px-6 relative">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold uppercase tracking-widest mb-6">
              <Zap className="w-3 h-3" />
              Next-Gen Observability
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              Shield Your Browser with Intelligence.
            </h1>
            <p className="text-lg text-slate-400 mb-10 leading-relaxed">
              WebPulse Guardian is an advanced Chromium extension that monitors performance, detects security anomalies, and analyzes network activity in real-time using heuristic intelligence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                Get Started
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-slate-800/50 border border-slate-700 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                <Terminal className="w-5 h-5" />
                View Source
              </button>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Live Demo / Dashboard Simulation */}
      <section id="demo" className="py-24 bg-[#0a0c10]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Real-Time Dashboard</h2>
              <p className="text-slate-400 mb-8">
                Experience the power of WebPulse Guardian. Our dashboard provides a comprehensive view of your browser's health, from memory leaks to suspicious network requests.
              </p>
              <ul className="space-y-4">
                {[
                  { icon: Activity, title: "Performance Metrics", desc: "Monitor heap size, CPU load, and DOM complexity." },
                  { icon: Shield, title: "Security Auditing", desc: "Detect eval(), suspicious scripts, and insecure connections." },
                  { icon: Globe, title: "Network Analysis", desc: "Identify bottleneck requests and suspicious domains." }
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <h4 className="font-bold">{item.title}</h4>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Simulated Extension Popup */}
            <div className="relative">
              <div className="absolute -inset-4 bg-sky-500/20 blur-3xl rounded-full"></div>
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative bg-[#1a1d23] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden w-full max-w-[380px] mx-auto"
              >
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#1a1d23]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-500" />
                    <span className="font-bold text-sm">WebPulse <span className="text-sky-500">Guardian</span></span>
                  </div>
                  <div className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-bold">
                    LOW RISK
                  </div>
                </div>
                
                <div className="p-4 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0f1115] p-3 rounded-xl border border-slate-800">
                      <label className="text-[10px] text-slate-500 font-bold block mb-1 uppercase">Memory</label>
                      <div className="text-xl font-mono font-bold">{Math.round(simulatedMetrics.memory)} MB</div>
                      <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500" style={{ width: '45%' }}></div>
                      </div>
                    </div>
                    <div className="bg-[#0f1115] p-3 rounded-xl border border-slate-800">
                      <label className="text-[10px] text-slate-500 font-bold block mb-1 uppercase">DOM Nodes</label>
                      <div className="text-xl font-mono font-bold">{simulatedMetrics.domNodes}</div>
                      <div className="text-[10px] text-green-500 mt-1">Stable</div>
                    </div>
                  </div>

                  <div className="bg-[#0f1115] rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-3 border-b border-slate-800 flex justify-between text-xs">
                      <span className="text-slate-500">Security Score</span>
                      <span className="text-green-500 font-bold">100/100</span>
                    </div>
                    <div className="p-3 border-b border-slate-800 flex justify-between text-xs">
                      <span className="text-slate-500">Network Activity</span>
                      <span className="text-slate-300">{simulatedMetrics.requests} requests</span>
                    </div>
                    <div className="p-3 flex justify-between text-xs">
                      <span className="text-slate-500">HTTPS Status</span>
                      <span className="text-green-500">Secure</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] text-slate-500 font-bold uppercase mb-3 tracking-wider">Active Anomalies</h4>
                    <div className="p-3 rounded-lg bg-slate-800/50 text-xs text-slate-500 italic text-center">
                      No anomalies detected.
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#0f1115] border-t border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    LIVE MONITORING
                  </div>
                  <span className="text-[10px] text-slate-600">v1.0.0</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Advanced Capabilities</h2>
            <p className="text-slate-400">Engineered for performance and security professionals.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: BarChart3, title: "Heap Analysis", desc: "Detect memory leaks by monitoring continuous growth in the JS heap." },
              { icon: Lock, title: "Phishing Detection", desc: "Identify suspicious forms, hidden inputs, and malicious redirects." },
              { icon: Cpu, title: "Resource Profiling", desc: "Approximate CPU load and monitor DOM mutation frequency." },
              { icon: Shield, title: "Script Guard", desc: "Block or alert on eval() usage and unknown external script injections." },
              { icon: Activity, title: "Anomaly Engine", desc: "Rule-based heuristic system classifies risks from Low to Critical." },
              { icon: Zap, title: "Real-time Alerts", desc: "Get instant notifications when high-risk behaviors are detected." }
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-2xl bg-slate-800/20 border border-slate-800 hover:border-sky-500/50 transition-all group">
                <feature.icon className="w-8 h-8 text-sky-500 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="py-24 bg-[#0a0c10] border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-slate-900/50 rounded-3xl p-8 md:p-16 border border-slate-800">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">Built on Manifest V3</h2>
                <p className="text-slate-400 mb-6 leading-relaxed">
                  WebPulse Guardian utilizes the latest browser extension standards for maximum performance and security. Our architecture separates data collection from analysis to ensure zero impact on page load times.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-sky-500" />
                    <span className="text-sm font-medium">Service Worker Background Logic</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-sky-500" />
                    <span className="text-sm font-medium">Non-blocking Content Injection</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-sky-500" />
                    <span className="text-sm font-medium">Secure Messaging Protocol</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#0f1115] rounded-xl p-6 font-mono text-xs text-sky-400 border border-slate-800 shadow-inner">
                <div className="flex gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
                <pre className="overflow-x-auto">
{`{
  "name": "WebPulse Guardian",
  "manifest_version": 3,
  "permissions": [
    "activeTab",
    "storage",
    "notifications"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-500" />
            <span className="font-bold">WebPulse Guardian</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 WebPulse Guardian. Advanced Browser Observability.</p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors">Documentation</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
