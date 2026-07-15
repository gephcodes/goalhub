import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  Check,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Users,
  Share2,
  Trash2,
  SlidersHorizontal,
  ArrowRight,
  ChevronRight,
  Clipboard,
  Copy,
  X,
  Keyboard,
  Compass,
  AlertTriangle,
  HelpCircle,
  Clock,
  Terminal,
  Activity,
  User,
  CheckSquare,
  Edit2,
  PlusSquare,
  Flame,
  Power,
  RefreshCw,
  Eye,
  Settings,
  Link,
  Plus,
  Radio,
  Lock,
  Shield,
} from "lucide-react";

import { TaskItem, ActionPlan, ChatMessage } from "./types";
import ParticleExplosion from "./components/ParticleExplosion";
import ShortcutToast, { ShortcutToastMessage } from "./components/ShortcutToast";
import ShortcutsHelp from "./components/ShortcutsHelp";
import LiquidEther from "./components/LiquidEther";

// Helper to get formatted local date string YYYY-MM-DD
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

// Helper to generate a randomized nickname/callsign
function generateRandomCallsign(): string {
  const prefixes = ["NEO", "CYPHER", "VECTOR", "ZAP", "NEXUS", "ROUTER", "MATRIX", "ALPHA", "GRID", "QUANTUM", "SHADOW", "COCKPIT", "PILOT", "STRAT", "GEPH", "SPECTER", "ORBIT", "APEX", "COBALT", "VORTEX", "APOLLO", "TITAN", "ODYSSEY", "PHANTOM", "SIERRA", "KILO", "ZULU", "ECHO"];
  const suffixes = ["X", "PRIME", "SQUAD", "BETA", "OPS", "CORE", "NODE", "8", "7", "99", "01", "77", "MK1", "PRO", "Z", "V2", "OMEGA"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const randomNum = Math.floor(10 + Math.random() * 90);
  const type = Math.floor(Math.random() * 3);
  if (type === 0) return `${prefix}_${suffix}`;
  if (type === 1) return `${prefix}_${randomNum}`;
  return `${prefix}_${suffix}_${randomNum}`;
}

interface DailyTask {
  id: string;
  text: string;
  completed: boolean;
}

interface SavedUrlItem {
  id: string;
  label: string;
  url: string;
}

export default function App() {
  // Goal and Plan States
  const [goal, setGoal] = useState<string>(() => {
    try {
      return localStorage.getItem("gp_goal") || "";
    } catch {
      return "";
    }
  });
  
  const [activePlan, setActivePlan] = useState<ActionPlan | null>(() => {
    try {
      const saved = localStorage.getItem("gp_active_plan");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.milestones) && Array.isArray(parsed.tasks)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("gp_chat_history");
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  // UI state
  const [inputGoal, setInputGoal] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isGoalUrlCopied, setIsGoalUrlCopied] = useState(false);

  // Sharing & Auto-Saving State Management
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get("planId");
    } catch {
      return null;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [planLoadError, setPlanLoadError] = useState<string | null>(null);
  const [initialLoadFinished, setInitialLoadFinished] = useState(false);

  // Interactive UI State Alterations
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<"ALL" | "High" | "Medium" | "Low">("ALL");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");
  const [focusedMilestone, setFocusedMilestone] = useState<string>("ALL");
  
  // Inline task addition states (per milestone name)
  const [inlineTaskTitles, setInlineTaskTitles] = useState<Record<string, string>>({});
  
  // Custom manual edit states for selected tasks
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");

  // Persistent Daily Checklist & Saved URLs
  const [dailyChecklist, setDailyChecklist] = useState<DailyTask[]>(() => {
    try {
      const saved = localStorage.getItem("gp_daily_checklist");
      return saved ? JSON.parse(saved) : [
        { id: "d1", text: "Execute daily sprint review", completed: false },
        { id: "d2", text: "Validate roadmap task priorities", completed: false },
        { id: "d3", text: "Synchronize team dashboard metrics", completed: false }
      ];
    } catch {
      return [];
    }
  });

  const [checklistTimestamp, setChecklistTimestamp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gp_daily_checklist_timestamp");
      return saved ? parseInt(saved, 10) : Date.now();
    } catch {
      return Date.now();
    }
  });

  const [newDailyText, setNewDailyText] = useState("");

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ============================================
  // EXPERT CHATTER INTERACTIVE STATE ENHANCEMENTS
  // ============================================
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [bursts, setBursts] = useState<{ id: string; x: number; y: number }[]>([]);
  const [toasts, setToasts] = useState<ShortcutToastMessage[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [shakeActive, setShakeActive] = useState<boolean>(false);

  // CO-WORKING USER-FLOW: ZERO-LOGIN STATES
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>(() => {
    try {
      return localStorage.getItem("coop_nickname") || "";
    } catch {
      return "";
    }
  });
  const [coopModeActive, setCoopModeActive] = useState<boolean>(false);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<any>(null);
  const lastUpdatedLocalRef = useRef<number>(0);

  // Administrative unique visitor token
  const [clientId] = useState<string>(() => {
    try {
      let id = localStorage.getItem("gp_client_id");
      if (!id) {
        id = "cli_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("gp_client_id", id);
      }
      return id;
    } catch {
      return "cli_temp_" + Math.random().toString(36).substring(2, 15);
    }
  });

  // Admin Dashboard Control States
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  // GUEST PRE-JOIN INTERCEPT LOBBY SYSTEM
  const [guestLobbyState, setGuestLobbyState] = useState<{
    active: boolean;
    creatorNickname: string;
    planId: string;
    goal: string;
    activePlan: any;
    chatHistory: any[];
  } | null>(null);

  // Local storage helpers to check if we created a planId
  const getCreatedPlans = (): string[] => {
    try {
      const saved = localStorage.getItem("gp_created_plans");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const addCreatedPlan = (id: string) => {
    try {
      const plans = getCreatedPlans();
      if (!plans.includes(id)) {
        plans.push(id);
        localStorage.setItem("gp_created_plans", JSON.stringify(plans));
      }
    } catch (err) {
      console.warn("localStorage gp_created_plans failed:", err);
    }
  };
  
  // Interface inputs for joining/entering room
  const [joinRoomCodeInput, setJoinRoomCodeInput] = useState<string>("");
  const [tempNicknameInput, setTempNicknameInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("coop_nickname");
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    return generateRandomCallsign();
  });
  const [lobbyToast, setLobbyToast] = useState<string | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  // Scroll tracking to hide buttons in header on scroll down
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const checklistPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const pane = document.getElementById("checklist_pane");
      if (!pane) return;
      setIsScrolled(pane.scrollTop > 15);
    };

    // Use capture phase on window to catch scrolls on the scrollable checklist_pane div
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    
    // Check initially
    handleScroll();

    // Recheck at a regular interval to ensure state matches dynamic DOM layouts
    const interval = setInterval(handleScroll, 150);

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      clearInterval(interval);
    };
  }, [activePlan]);

  // Custom critical warning modal states
  const [warningModalOpen, setWarningModalOpen] = useState<boolean>(false);
  const [warningModalMessage, setWarningModalMessage] = useState<string>("");
  const [warningModalAction, setWarningModalAction] = useState<(() => void) | null>(null);

  const triggerWarningModal = (message: string, onConfirm: () => void) => {
    setWarningModalMessage(message);
    setWarningModalAction(() => onConfirm);
    setWarningModalOpen(true);
  };

  // Focus Status States (Transmission to HUD)
  const [customActivityText, setCustomActivityText] = useState<string>("Executing Tactical Focus");

  // Silent tracking ping effect to report user presence
  useEffect(() => {
    const doPing = async () => {
      try {
        await fetch("/api/admin/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            goal: goal || undefined,
            activePlanTitle: activePlan?.planTitle || undefined,
            coOpRoom: roomCode || undefined,
            nickname: nickname || undefined,
          }),
        });
      } catch (err) {
        // Completely silent failure to prevent UI errors/logs
      }
    };

    // Ping immediately on load or state updates
    doPing();

    // Ping every 15 seconds to maintain active status
    const interval = setInterval(doPing, 15000);
    return () => clearInterval(interval);
  }, [clientId, goal, activePlan?.planTitle, roomCode, nickname]);

  // Sync state values to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("gp_goal", goal);
    } catch (err) {
      console.warn("localStorage setItem failed:", err);
    }
  }, [goal]);

  useEffect(() => {
    try {
      if (activePlan) {
        localStorage.setItem("gp_active_plan", JSON.stringify(activePlan));
      } else {
        localStorage.removeItem("gp_active_plan");
      }
    } catch (err) {
      console.warn("localStorage activePlan sync failed:", err);
    }
  }, [activePlan]);

  useEffect(() => {
    try {
      localStorage.setItem("gp_chat_history", JSON.stringify(chatHistory));
    } catch (err) {
      console.warn("localStorage setItem failed:", err);
    }
  }, [chatHistory]);

  useEffect(() => {
    try {
      localStorage.setItem("gp_daily_checklist", JSON.stringify(dailyChecklist));
    } catch (err) {
      console.warn("localStorage gp_daily_checklist sync failed:", err);
    }
  }, [dailyChecklist]);

  // Keep track of the last processed planTitle to avoid infinite loops and duplicate generations
  const lastProcessedPlanTitleRef = useRef<string | null>(null);

  // Helper to generate the daily operations checklist dynamically from the roadmap plan
  const generateDailyChecklistFromPlan = (plan: ActionPlan, force = false) => {
    if (!plan) return;
    if (!force && lastProcessedPlanTitleRef.current === plan.planTitle) {
      return;
    }
    lastProcessedPlanTitleRef.current = plan.planTitle;
    
    const limitText = (prefix: string, content: string) => {
      const maxLen = 28;
      const clean = content.trim();
      const truncated = clean.length > maxLen ? clean.substring(0, maxLen - 3).trim() + "..." : clean;
      return `${prefix}: ${truncated}`;
    };

    // Generate daily checklist items from the active action plan tasks!
    const generatedTasks: DailyTask[] = [
      {
        id: "d-overall-" + Date.now(),
        text: limitText("Milestone Run", plan.planTitle),
        completed: false,
      }
    ];

    // Pick up to 2 High priority tasks
    const highTasks = plan.tasks.filter(t => t.priority === "High" || t.priority === "HIGH");
    highTasks.slice(0, 2).forEach((task, idx) => {
      generatedTasks.push({
        id: `d-high-${idx}-${Date.now()}`,
        text: limitText("High Priority", task.title),
        completed: false,
      });
    });

    // Pick up to 2 Medium/Low tasks
    const normalTasks = plan.tasks.filter(t => t.priority !== "High" && t.priority !== "HIGH");
    normalTasks.slice(0, 2).forEach((task, idx) => {
      generatedTasks.push({
        id: `d-norm-${idx}-${Date.now()}`,
        text: limitText("Milestone Task", task.title),
        completed: false,
      });
    });

    // Add standard sprint follow up
    generatedTasks.push({
      id: "d-sync-" + Date.now(),
      text: "Validate timeline & roadblocks",
      completed: false,
    });

    setDailyChecklist(generatedTasks);
    setChecklistTimestamp(Date.now());
    localStorage.setItem("gp_daily_checklist", JSON.stringify(generatedTasks));
    localStorage.setItem("gp_daily_checklist_timestamp", String(Date.now()));
    triggerToast(["CHECKLIST"], "NEW DAILY CHECKLIST GENERATED");
  };

  // Initialize the processed ref on mount with any pre-loaded plan to avoid wiping user checked status
  useEffect(() => {
    if (activePlan) {
      lastProcessedPlanTitleRef.current = activePlan.planTitle;
    }
  }, []);

  // Sync checklist generation when activePlan changes (e.g., room change or new plan)
  useEffect(() => {
    if (activePlan) {
      generateDailyChecklistFromPlan(activePlan, false);
    } else {
      lastProcessedPlanTitleRef.current = null;
    }
  }, [activePlan]);

  // Periodic 24h refresh handler
  useEffect(() => {
    const checkRefresh = () => {
      try {
        const savedTime = localStorage.getItem("gp_daily_checklist_timestamp");
        if (savedTime) {
          const timestamp = parseInt(savedTime, 10);
          const now = Date.now();
          const oneDayMs = 24 * 60 * 60 * 1000;
          if (now - timestamp >= oneDayMs) {
            // Reset daily checklist items back to uncompleted for the new day
            setDailyChecklist((prev) => {
              const refreshed = prev.map(t => ({ ...t, completed: false }));
              localStorage.setItem("gp_daily_checklist", JSON.stringify(refreshed));
              return refreshed;
            });
            const newTimestamp = Date.now();
            setChecklistTimestamp(newTimestamp);
            localStorage.setItem("gp_daily_checklist_timestamp", String(newTimestamp));
            triggerToast(["CHECKLIST"], "DAILY REFRESH COMPLETED (24H)");
          }
        } else {
          localStorage.setItem("gp_daily_checklist_timestamp", String(Date.now()));
        }
      } catch (err) {
        console.warn("24h checklist check refresh error:", err);
      }
    };

    checkRefresh();
    const interval = setInterval(checkRefresh, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Scroll smoothly when chats arrive
  useEffect(() => {
    try {
      if (chatBottomRef.current) {
        chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
    } catch (e) {
      try {
        if (chatBottomRef.current) {
          chatBottomRef.current.scrollIntoView();
        }
      } catch (scrollErr) {
        console.warn("scrollIntoView failed:", scrollErr);
      }
    }
  }, [chatHistory, isLoading]);

  // Sync selected task edit state on click
  useEffect(() => {
    if (selectedTaskId && activePlan) {
      const t = activePlan.tasks.find(x => x.id === selectedTaskId);
      if (t) {
        setEditTaskTitle(t.title);
        setEditTaskDesc(t.shortDescription);
      }
    } else {
      setEditTaskTitle("");
      setEditTaskDesc("");
    }
  }, [selectedTaskId, activePlan]);

  // Keyboard macro trigger feedback helper
  const triggerToast = (keys: string[], action: string) => {
    const newToast: ShortcutToastMessage = {
      id: Math.random().toString(),
      keys,
      action
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 1800);
  };

  // Keyboard shortcut routing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Esc to clear modal or selections
      if (e.key === "Escape") {
        if (isHelpOpen) {
          setIsHelpOpen(false);
          triggerToast(["ESC"], "Dictionary Panel Closed");
        } else if (selectedTaskId) {
          setSelectedTaskId(null);
          triggerToast(["ESC"], "Deselected Nodes");
        }
        return;
      }

      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "f") {
          e.preventDefault();
          setFocusMode((prev) => {
            const next = !prev;
            triggerToast(["⌥", "F"], next ? "Focus Mode Active" : "Focus Mode Disabled");
            return next;
          });
        } else if (key === "c") {
          e.preventDefault();
          handleCopyToClipboard();
        } else if (key === "s") {
          e.preventDefault();
          // Scroll or anchor focus to relevant lobby trigger cards
          const radarBox = document.getElementById("coworking_radar_box");
          if (radarBox) {
            radarBox.scrollIntoView({ behavior: "smooth" });
            triggerToast(["⌥", "S"], "Radar Controller Focused");
          } else {
            triggerToast(["⌥", "S"], "Lobby System Active");
          }
        } else if (key === "i") {
          e.preventDefault();
          const searchInput = document.getElementById("search_input_el") as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            triggerToast(["⌥", "I"], "Search Matrix Active");
          }
        } else if (key === "k") {
          e.preventDefault();
          setIsHelpOpen((prev) => !prev);
          triggerToast(["⌥", "K"], "Keyboard Guide Triggered");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePlan, focusMode, isHelpOpen, selectedTaskId]);

  // Parse URL on initial load for planId or roomCode
  useEffect(() => {
    const parseUrlParams = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const urlPlanId = queryParams.get("planId");
      const urlRoomCode = queryParams.get("room");

      if (urlRoomCode) {
        const upperRoom = urlRoomCode.toUpperCase();
        setJoinRoomCodeInput(upperRoom);
        setIsLoading(true);
        setErrorMsg(null);
        try {
          const res = await fetch(`/api/coop/state/${upperRoom}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.roomState) {
              // Find host name if any
              let hostName = "Creator";
              if (data.roomState.players) {
                const hostPlayer = Object.values(data.roomState.players).find((p: any) => p.isHost);
                if (hostPlayer) {
                  hostName = (hostPlayer as any).nickname;
                }
              }
              setGuestLobbyState({
                active: true,
                creatorNickname: hostName,
                planId: upperRoom,
                goal: data.roomState.goal || "",
                activePlan: data.roomState.activePlan,
                chatHistory: data.roomState.chatHistory || []
              });
            }
          }
        } catch (err) {
          console.warn("Failed to fetch live room state:", err);
        } finally {
          setIsLoading(false);
          setInitialLoadFinished(true);
        }
        return;
      }

      if (!urlPlanId) {
        setInitialLoadFinished(true);
        setCurrentPlanId(null);
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);
      setPlanLoadError(null);
      try {
        const res = await fetch(`/api/get-shared-plan/${urlPlanId}`);
        if (!res.ok) {
          throw new Error("Plan not found or could not be loaded from server.");
        }
        const data = await res.json();
        if (data && data.activePlan) {
          // Load normally for everyone (no co-op intercept wall for planId)
          setGoal(data.goal || "");
          setActivePlan(data.activePlan);
          setChatHistory(data.chatHistory || []);
          setCurrentPlanId(urlPlanId);

          // Set the room code for future co-op activation if the user chooses to start co-working
          setRoomCode(urlPlanId);
        }
      } catch (err: any) {
        console.error("Failed to load shared plan:", err);
        setPlanLoadError(err.message || "Failed to load shared link.");
      } finally {
        setIsLoading(false);
        setInitialLoadFinished(true);
      }
    };

    parseUrlParams();
  }, []);

  // Sync to database (Fallback option)
  const syncPlanToServer = async (g: string, ap: ActionPlan, ch: ChatMessage[], pid: string | null) => {
    if (!initialLoadFinished || !ap || coopModeActive) return;
    setIsSyncing(true);
    try {
      const userNick = nickname || tempNicknameInput || generateRandomCallsign();
      if (!nickname) {
        setNickname(userNick);
        localStorage.setItem("coop_nickname", userNick);
      }

      const response = await fetch("/api/save-shared-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pid || undefined,
          goal: g,
          activePlan: ap,
          chatHistory: ch,
          creatorNickname: userNick
        })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData && resData.id) {
          const generatedId = resData.id;
          addCreatedPlan(generatedId);

          if (generatedId !== pid) {
            setCurrentPlanId(generatedId);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("planId", generatedId);
            window.history.pushState({}, "", newUrl.toString());
          }

          // Set room code matching this plan ID for future co-op use
          setRoomCode(generatedId);
        }
      }
    } catch (err) {
      console.warn("[GoalPlan AI] Sync to database failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Debounced auto-save
  useEffect(() => {
    if (!initialLoadFinished || !activePlan || coopModeActive) return;
    
    const timer = setTimeout(() => {
      syncPlanToServer(goal, activePlan, chatHistory, currentPlanId);
    }, 1200);

    return () => clearTimeout(timer);
  }, [goal, activePlan, chatHistory, currentPlanId, coopModeActive]);

  // ============================================
  // CO-WORKING HEARTBEAT & SYNC EFFECTS
  // ============================================

  // Poll server for Co-Op Room State updates
  useEffect(() => {
    if (!coopModeActive || !roomCode || !nickname) return;

    const fetchRoomState = async () => {
      try {
        const res = await fetch(`/api/coop/state/${roomCode}?nickname=${encodeURIComponent(nickname)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.roomState) {
            setRoomState(data.roomState);
            
            // Equal rights syncing logic for both guest and host
            if (data.roomState.activePlan) {
              const serverPlanStr = JSON.stringify(data.roomState.activePlan);
              const localPlanStr = JSON.stringify(activePlan);
              const isRecentLocalUpdate = lastUpdatedLocalRef.current && (Date.now() - lastUpdatedLocalRef.current < 2500);

              if (!isRecentLocalUpdate) {
                if (serverPlanStr !== localPlanStr) {
                  setActivePlan(data.roomState.activePlan);
                }
                if (data.roomState.goal !== goal) {
                  setGoal(data.roomState.goal);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Error polling lobby radar state:", err);
      }
    };

    fetchRoomState();
    const interval = setInterval(fetchRoomState, 2000);
    return () => clearInterval(interval);
  }, [coopModeActive, roomCode, nickname, isHost]);

  // Instantly send update when focus timer, activity, or completed task length changes
  const updatePlayerStatusOnServer = async (updates: {
    isFocused?: boolean;
    currentActivity?: string;
    completedPoints?: number;
    totalPoints?: number;
    isBlurred?: boolean;
  }) => {
    if (!coopModeActive || !roomCode || !nickname) return;
    try {
      await fetch("/api/coop/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          nickname,
          isFocused: updates.isFocused !== undefined ? updates.isFocused : focusMode,
          currentActivity: updates.currentActivity !== undefined ? updates.currentActivity : customActivityText,
          completedPoints: updates.completedPoints !== undefined ? updates.completedPoints : (activePlan?.tasks.filter(t => t.isCompleted).length || 0),
          totalPoints: updates.totalPoints !== undefined ? updates.totalPoints : (activePlan?.tasks.length || 0),
          isBlurred: updates.isBlurred !== undefined ? updates.isBlurred : false
        })
      });
    } catch (err) {
      console.warn("Lobby status update failed", err);
    }
  };

  // Accountability: window tab focus / blur detectors
  useEffect(() => {
    if (!coopModeActive || !roomCode || !nickname) return;

    const handleBlur = () => {
      updatePlayerStatusOnServer({ isBlurred: true });
    };
    const handleFocus = () => {
      updatePlayerStatusOnServer({ isBlurred: false });
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [coopModeActive, roomCode, nickname, focusMode, customActivityText, activePlan]);

  // Synchronous change dispatch for focus state
  useEffect(() => {
    if (coopModeActive) {
      updatePlayerStatusOnServer({ isFocused: focusMode });
    }
  }, [focusMode]);

  // Synchronous change dispatch for activity specs
  useEffect(() => {
    if (coopModeActive) {
      updatePlayerStatusOnServer({ currentActivity: customActivityText });
    }
  }, [customActivityText]);

  // Synchronous update when tasks modification happens
  useEffect(() => {
    if (coopModeActive && activePlan) {
      updatePlayerStatusOnServer({
        completedPoints: activePlan.tasks.filter(t => t.isCompleted).length,
        totalPoints: activePlan.tasks.length
      });
    }
  }, [activePlan?.tasks]);

  // Synchronous update of the shared co-op plan to the server when modified by anyone
  useEffect(() => {
    if (!initialLoadFinished || !coopModeActive || !roomCode || !activePlan) return;
    
    const syncCoopPlanToServer = async () => {
      try {
        const response = await fetch("/api/coop/update-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode,
            nickname,
            goal,
            activePlan
          })
        });
        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.roomState) {
            setRoomState(resData.roomState);
          }
        }
      } catch (err) {
        console.warn("Failed to sync co-op plan to server:", err);
      }
    };

    lastUpdatedLocalRef.current = Date.now();

    const handler = setTimeout(() => {
      syncCoopPlanToServer();
    }, 200);

    return () => clearTimeout(handler);
  }, [activePlan, goal, coopModeActive, roomCode]);

  // DAILY NON-NEGOTIABLES / DAILY BOUNTIES RESET EVERY DAY AT 12 AM (MIDNIGHT LOCAL TIME)
  useEffect(() => {
    const checkMidnightReset = () => {
      const todayStr = getLocalDateString();
      const lastReset = localStorage.getItem("gp_last_reset_date");
      
      if (!lastReset) {
        // Initialize for today on first boot so it triggers at subsequent midnights
        localStorage.setItem("gp_last_reset_date", todayStr);
        return;
      }
      
      if (lastReset !== todayStr) {
        // We crossed midnight! Reset non-negotiable daily tasks.
        if (activePlan && activePlan.tasks.length > 0) {
          const resetTasks = activePlan.tasks.map((t) => ({ ...t, isCompleted: false }));
          setActivePlan((prev) => (prev ? { ...prev, tasks: resetTasks } : null));
          triggerToast(["RESET"], "MIDNIGHT RESET: DAILY BOUNTIES RESTORED");
        }
        localStorage.setItem("gp_last_reset_date", todayStr);
      }
    };

    // Run check immediately on load/render
    checkMidnightReset();

    // Poll every 10 seconds to catch midnight transition in real-time
    const interval = setInterval(checkMidnightReset, 10000);
    return () => clearInterval(interval);
  }, [activePlan]);

  // Spawn Lobby Creator
  const handleSpawnLobby = async () => {
    if (!tempNicknameInput.trim()) {
      setLobbyError("TEMPORARY NICKNAME IS REQUIRED TO INITIALIZE WORKSPACE.");
      return;
    }

    setLobbyError(null);
    setIsLoading(true);

    try {
      const savedNick = tempNicknameInput.trim().toUpperCase();
      setNickname(savedNick);
      localStorage.setItem("coop_nickname", savedNick);

      const res = await fetch("/api/coop/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: savedNick,
          goal: goal,
          activePlan: activePlan
        })
      });

      if (!res.ok) {
        throw new Error("Lobby spawning failure on remote portal.");
      }

      const resData = await res.json();
      if (resData.success && resData.roomCode) {
        setRoomCode(resData.roomCode);
        setRoomState(resData.roomState);
        setCoopModeActive(true);
        setIsHost(true);
        
        const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${resData.roomCode}`;
        triggerToast(["CO-OP"], "CO-OP ACTIVE. SHARE ROOM!");
        setLobbyToast(`CO-OP LOBBY CREATED! Room: ${resData.roomCode}`);
        setTimeout(() => setLobbyToast(null), 10000);

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("room", resData.roomCode);
        window.history.pushState({}, "", newUrl.toString());
      }
    } catch (err: any) {
      console.error(err);
      setLobbyError(err.message || "Failed to initialize active co-op radar.");
    } finally {
      setIsLoading(false);
    }
  };

  // Join Existing Lobby
  const handleJoinLobby = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetedCode = joinRoomCodeInput.trim().toUpperCase();
    const targetNick = tempNicknameInput.trim().toUpperCase();

    if (!targetedCode) {
      setLobbyError("LOBBY ROOM CODE IS REQUIRED.");
      return;
    }
    if (!targetNick) {
      setLobbyError("TEMPORARY NICKNAME IS REQUIRED.");
      return;
    }

    setLobbyError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/coop/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: targetedCode,
          nickname: targetNick
        })
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Room validation failed. Check room code.");
      }

      const resData = await res.json();
      if (resData.success && resData.roomState) {
        setNickname(targetNick);
        localStorage.setItem("coop_nickname", targetNick);
        setRoomCode(targetedCode);
        setRoomState(resData.roomState);
        setCoopModeActive(true);
        setIsHost(false);

        if (resData.roomState.activePlan) {
          setActivePlan(resData.roomState.activePlan);
          setGoal(resData.roomState.goal);
        }

        triggerToast(["CONNECT"], "CONNECTED COCKPIT");
        setLobbyToast(`Connected to room ${targetedCode}!`);
        setTimeout(() => setLobbyToast(null), 5000);

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("room", targetedCode);
        window.history.pushState({}, "", newUrl.toString());
      }
    } catch (err: any) {
      console.error(err);
      setLobbyError(err.message || "Radar synchronization failure.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveLobby = () => {
    triggerWarningModal("Warning: Disconnecting will exit this live Co-Op room. Your local session will be cleared.", () => {
      setGoal("");
      setInputGoal("");
      setActivePlan(null);
      setChatHistory([]);
      setErrorMsg(null);
      setCurrentPlanId(null);
      setSelectedTaskId(null);
      setFocusedMilestone("ALL");
      setCoopModeActive(false);
      setRoomCode(null);
      setRoomState(null);
      setIsHost(false);
      setDailyChecklist([
        { id: "d1", text: "Execute daily sprint review", completed: false },
        { id: "d2", text: "Validate roadmap task priorities", completed: false },
        { id: "d3", text: "Synchronize team dashboard metrics", completed: false }
      ]);
      
      try {
        localStorage.removeItem("gp_goal");
        localStorage.removeItem("gp_active_plan");
        localStorage.removeItem("gp_chat_history");
        
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("planId");
        newUrl.searchParams.delete("room");
        window.history.pushState({}, "", newUrl.pathname + newUrl.search);
      } catch (err) {
        console.warn("localStorage removeItem failed:", err);
      }
      triggerToast(["RESET"], "LOBBY DISCONNECTED");
    });
  };

  const handleStartCoWorking = async () => {
    let activeNick = nickname || tempNicknameInput.trim();
    if (!activeNick) {
      activeNick = generateRandomCallsign();
      setNickname(activeNick);
      localStorage.setItem("coop_nickname", activeNick);
    }
    setTempNicknameInput(activeNick);
    
    const targetRoomCode = currentPlanId || Math.random().toString(36).substring(2, 11).toUpperCase();
    setIsLoading(true);
    try {
      const res = await fetch("/api/coop/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: targetRoomCode,
          nickname: activeNick,
          goal: goal,
          activePlan: activePlan
        })
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.success && resData.roomCode) {
          setRoomCode(resData.roomCode);
          setRoomState(resData.roomState);
          setCoopModeActive(true);
          setIsHost(true);
          
          if (!currentPlanId) {
            setCurrentPlanId(resData.roomCode);
            addCreatedPlan(resData.roomCode);
          }

          const inviteUrl = `${window.location.origin}${window.location.pathname}?planId=${resData.roomCode}`;
          triggerToast(["CO-OP"], "CO-OP ACTIVE. SHARE ROOM!");
          setLobbyToast(`CO-OP LOBBY CREATED! Room: ${resData.roomCode}`);
          setTimeout(() => setLobbyToast(null), 10000);

          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("planId", resData.roomCode);
          window.history.pushState({}, "", newUrl.toString());
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgradeToCoWorking = async () => {
    if (!activePlan) return;
    try {
      // 1. Copy plan link and generate/save shared plan first
      let planIdToUse = currentPlanId;
      if (!planIdToUse) {
        setIsSyncing(true);
        const response = await fetch("/api/save-shared-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: goal,
            activePlan: activePlan,
            chatHistory: chatHistory
          })
        });
        if (response.ok) {
          const resData = await response.json();
          if (resData && resData.id) {
            setCurrentPlanId(resData.id);
            planIdToUse = resData.id;
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("planId", resData.id);
            window.history.pushState({}, "", newUrl.toString());
          }
        }
      }

      if (planIdToUse) {
        const goalUrl = `${window.location.origin}${window.location.pathname}?planId=${planIdToUse}`;
        await navigator.clipboard.writeText(goalUrl);
        setIsGoalUrlCopied(true);
        setTimeout(() => setIsGoalUrlCopied(false), 2000);
        triggerToast(["⌥", "L"], "GOAL SHARE URL COPIED");
      }

      // 2. Start co-working lobby
      let activeNick = nickname || tempNicknameInput.trim();
      if (!activeNick) {
        activeNick = generateRandomCallsign();
        setNickname(activeNick);
        localStorage.setItem("coop_nickname", activeNick);
      }
      setTempNicknameInput(activeNick);

      const targetRoomCode = planIdToUse || Math.random().toString(36).substring(2, 11).toUpperCase();
      setIsLoading(true);
      const res = await fetch("/api/coop/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: targetRoomCode,
          nickname: activeNick,
          goal: goal,
          activePlan: activePlan
        })
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.success && resData.roomCode) {
          setRoomCode(resData.roomCode);
          setRoomState(resData.roomState);
          setCoopModeActive(true);
          setIsHost(true);
          
          if (!currentPlanId) {
            setCurrentPlanId(resData.roomCode);
            addCreatedPlan(resData.roomCode);
          }

          triggerToast(["CO-OP"], "CO-OP ACTIVE. SHARE ROOM!");
          setLobbyToast(`CO-OP LOBBY CREATED! Room: ${resData.roomCode}`);
          setTimeout(() => setLobbyToast(null), 10000);

          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("room", resData.roomCode);
          window.history.pushState({}, "", newUrl.toString());
        }
      }
    } catch (err) {
      console.error(err);
      triggerToast(["WARN"], "UPGRADE FAILED");
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  // Helper to copy co-working direct URL with Room Code
  const handleCopyCoopUrl = () => {
    if (!roomCode) return;
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      navigator.clipboard.writeText(shareUrl);
      triggerToast(["COPY"], "LOBBY LINK COPIED");
      setLobbyToast("Co-op lobby link copied!");
      setTimeout(() => setLobbyToast(null), 8000);
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
    }
  };

  const fetchAdminStats = async (overridePasscode?: string) => {
    const codeToUse = overridePasscode !== undefined ? overridePasscode : adminPasscode;
    if (!codeToUse) {
      setAdminError("Administrative passcode is required.");
      return;
    }
    setIsAdminLoading(true);
    setAdminError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: codeToUse, clientId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminStats(data.stats);
        setIsAdminAuthenticated(true);
        setAdminError(null);
      } else {
        setAdminError(data.error || "Authentication failed.");
      }
    } catch (err) {
      setAdminError("Network failure or system offline.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  // XP sync combo multiplier calculations
  const isSyncComboActive = () => {
    if (!coopModeActive || !roomState || !focusMode) return false;
    const playersObj = roomState.players || {};
    return Object.values(playersObj).some((p: any) => p.nickname !== nickname && p.isFocused === true);
  };

  const generatePlanDirectly = async (targetGoal: string) => {
    if (!targetGoal) return;

    // Ensure creator is assigned a persistent or session-based username
    let creatorNick = nickname;
    if (!creatorNick) {
      creatorNick = tempNicknameInput.trim() || generateRandomCallsign();
      setNickname(creatorNick);
      localStorage.setItem("coop_nickname", creatorNick);
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: targetGoal }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server HTTP Error: ${response.status}`);
      }

      const planData = await response.json();
      
      const formattedTasks = (planData.tasks || []).map((t: any) => ({
        ...t,
        isCompleted: false,
      }));

      const finalPlan: ActionPlan = {
        ...planData,
        tasks: formattedTasks,
      };

      setGoal(targetGoal);
      setActivePlan(finalPlan);
      setSelectedTaskId(null);
      setFocusedMilestone("ALL");
      
      // Explicitly force checklist generation on the first generation of a new goal
      generateDailyChecklistFromPlan(finalPlan, true);
      
      setChatHistory([
        {
          role: "assistant",
          content: planData.chatResponse || "Master tactical timeline formulated. Inspect items or interact with the console below to customize elements.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      
      setInputGoal("");

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while building your strategy plan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePillClick = async (suggestion: string) => {
    setInputGoal(suggestion);
    await generatePlanDirectly(suggestion);
  };

  // Generate Plan Trigger
  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetGoal = inputGoal.trim();
    if (!targetGoal) return;
    await generatePlanDirectly(targetGoal);
  };

  // Send follow-up chat message
  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const userMsgText = chatInput.trim();
    if (!userMsgText || isLoading || !activePlan) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setChatInput("");
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal,
          chatHistory: chatHistory.map(h => ({ role: h.role, content: h.content })),
          userMessage: userMsgText
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server Response Error: ${response.status}`);
      }

      const planData = await response.json();

      const mergedTasks = (planData.tasks || []).map((newTask: any) => {
        const existingTask = activePlan.tasks.find(
          et => et.title.toLowerCase() === newTask.title.toLowerCase() || et.id === newTask.id
        );
        return {
          ...newTask,
          isCompleted: existingTask ? existingTask.isCompleted : false
        };
      });

      const updatedPlan: ActionPlan = {
        ...planData,
        tasks: mergedTasks,
      };

      setActivePlan(updatedPlan);
      setChatHistory([
        ...updatedHistory,
        {
          role: "assistant",
          content: planData.chatResponse || "Master plan parameters successfully adjusted to updated parameters.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to adjust action plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action: Send prompt idea
  const triggerQuickPrompt = (promptText: string) => {
    if (isLoading || !activePlan) return;
    setChatInput(promptText);
    
    const userMsg: ChatMessage = {
      role: "user",
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setIsLoading(true);
    setErrorMsg(null);
    
    fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: goal,
        chatHistory: chatHistory.map(h => ({ role: h.role, content: h.content })),
        userMessage: promptText
      })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      return res.json();
    })
    .then(planData => {
      const mergedTasks = (planData.tasks || []).map((newTask: any) => {
        const existingTask = activePlan.tasks.find(
          et => et.title.toLowerCase() === newTask.title.toLowerCase() || et.id === newTask.id
        );
        return {
          ...newTask,
          isCompleted: existingTask ? existingTask.isCompleted : false
        };
      });
      setActivePlan({
        ...planData,
        tasks: mergedTasks
      });
      setChatHistory([
        ...updatedHistory,
        {
          role: "assistant",
          content: planData.chatResponse || "Adjustments applied based on prompt request.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    })
    .catch((err: any) => {
      console.error(err);
      setErrorMsg(err.message || "Failed to adjust schematic. Please try again.");
    })
    .finally(() => {
      setIsLoading(false);
      setChatInput("");
    });
  };

  // Daily Checklist handlers
  const handleAddDailyTask = (textToAdd?: string) => {
    const text = typeof textToAdd === "string" ? textToAdd.trim() : newDailyText.trim();
    if (!text) return;
    setDailyChecklist((prev) => [
      ...prev,
      { id: "d-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4), text, completed: false }
    ]);
    if (typeof textToAdd !== "string") {
      setNewDailyText("");
    }
    triggerToast(["CHECKLIST"], `Added: "${text.substring(0, 20)}..."`);
  };

  const handleToggleDailyTask = (id: string) => {
    setDailyChecklist((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextState = !item.completed;
          if (nextState) {
            // Trigger simple micro tone
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
              osc.frequency.exponentialRampToValueAtTime(987.77, audioCtx.currentTime + 0.08); // B5
              gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
              gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.12);
            } catch (e) {}
          }
          return { ...item, completed: nextState };
        }
        return item;
      })
    );
  };

  const handleDeleteDailyTask = (id: string) => {
    setDailyChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  // Checklist toggles
  const handleToggleTask = (taskId: string, e?: React.MouseEvent) => {
    if (!activePlan) return;
    
    const isChecking = !activePlan.tasks.find(t => t.id === taskId)?.isCompleted;
    if (isChecking) {
      // Screen Shake
      setShakeActive(true);
      setTimeout(() => setShakeActive(false), 200);

      // Acoustic micro feedback blip (D5 -> A5)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch {
        // block
      }

      // Capture click position or generate custom coordinates in center as alternative
      const clickX = e ? e.clientX : window.innerWidth / 2;
      const clickY = e ? e.clientY : window.innerHeight / 2;

      // Spawn Crisp Particle Burst
      const newBurst = {
        id: Math.random().toString(),
        x: clickX,
        y: clickY
      };
      setBursts((prev) => [...prev, newBurst]);
    }

    const updatedTasks = activePlan.tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, isCompleted: !t.isCompleted };
      }
      return t;
    });
    setActivePlan({ ...activePlan, tasks: updatedTasks });
  };

  // Remove explosion burst helper
  const removeBurst = (burstId: string) => {
    setBursts((prev) => prev.filter((b) => b.id !== burstId));
  };

  // Add custom manual task inline inside a chosen milestone
  const handleAddInlineTask = (milestoneName: string) => {
    if (!activePlan) return;
    const itemTitle = inlineTaskTitles[milestoneName]?.trim();
    if (!itemTitle) return;

    const customTask: TaskItem = {
      id: `custom-task-${Date.now()}`,
      title: itemTitle,
      milestone: milestoneName,
      priority: "Medium",
      shortDescription: "Custom action step added.",
      isCompleted: false,
      estimatedEffort: "Short",
    };

    setActivePlan({
      ...activePlan,
      tasks: [...activePlan.tasks, customTask],
    });

    setInlineTaskTitles(prev => ({
      ...prev,
      [milestoneName]: ""
    }));

    triggerToast(["ADD"], "MANUAL CHECKLIST STEP ADDED");
  };

  // Modify individual items in active plan
  const handleSaveEditedTask = (taskId: string) => {
    if (!activePlan) return;
    const updatedTasks = activePlan.tasks.map(t => {
      if (t.id === taskId) {
        return { 
          ...t, 
          title: editTaskTitle.trim() || t.title,
          shortDescription: editTaskDesc.trim() || t.shortDescription
        };
      }
      return t;
    });
    setActivePlan({ ...activePlan, tasks: updatedTasks });
    setSelectedTaskId(null); // Deselect on save
    triggerToast(["SAVE"], "TASK SPECIFICATION MODIFIED");
  };

  const handleUpdateTaskPriority = (taskId: string, priorityValue: string) => {
    if (!activePlan) return;
    const updatedTasks = activePlan.tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, priority: priorityValue };
      }
      return t;
    });
    setActivePlan({ ...activePlan, tasks: updatedTasks });
  };

  // Check/uncheck all in a specific phase
  const handleTogglePhaseAll = (milestoneName: string, isAllCompleted: boolean) => {
    if (!activePlan) return;
    const updatedTasks = activePlan.tasks.map(t => {
      if (t.milestone === milestoneName) {
        return { ...t, isCompleted: isAllCompleted };
      }
      return t;
    });
    setActivePlan({ ...activePlan, tasks: updatedTasks });
    triggerToast(["PHASE"], isAllCompleted ? "ENTIRE PHASE MARKED COMPLETED" : "PHASE RESET TO ACTIVE");
  };

  // Delete task item
  const handleDeleteTask = (taskId: string) => {
    if (!activePlan) return;
    const filteredTasks = activePlan.tasks.filter(t => t.id !== taskId);
    setActivePlan({ ...activePlan, tasks: filteredTasks });
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
    triggerToast(["DELETE"], "DISCRETE TASK NODE PURGED");
  };

  // Reset core Workspace to create new goal plans
  const handleResetWorkspace = () => {
    triggerWarningModal("Warning: Goal may be lost permanently.", () => {
      setGoal("");
      setInputGoal("");
      setActivePlan(null);
      setChatHistory([]);
      setErrorMsg(null);
      setCurrentPlanId(null);
      setSelectedTaskId(null);
      setFocusedMilestone("ALL");
      setCoopModeActive(false);
      setRoomCode(null);
      setRoomState(null);
      setIsHost(false);
      setDailyChecklist([
        { id: "d1", text: "Execute daily sprint review", completed: false },
        { id: "d2", text: "Validate roadmap task priorities", completed: false },
        { id: "d3", text: "Synchronize team dashboard metrics", completed: false }
      ]);
      try {
        localStorage.removeItem("gp_goal");
        localStorage.removeItem("gp_active_plan");
        localStorage.removeItem("gp_chat_history");
        
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("planId");
        newUrl.searchParams.delete("room");
        window.history.pushState({}, "", newUrl.pathname + newUrl.search);
      } catch (err) {
        console.warn("localStorage removeItem failed:", err);
      }
      triggerToast(["RESET"], "WORKSPACE CLEAR");
    });
  };

  // Clipboard copy
  const handleCopyToClipboard = () => {
    if (!activePlan) return;
    try {
      navigator.clipboard.writeText(activePlan.richPlanDetails || "");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      triggerToast(["⌥", "C"], "ROADMAP SPEC COPIED");
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
    }
  };

  // Copy Goal's exact permanent URL to clipboard
  const handleCopyGoalUrl = async () => {
    if (!activePlan) return;
    try {
      let planIdToUse = currentPlanId;
      if (!planIdToUse) {
        setIsSyncing(true);
        const response = await fetch("/api/save-shared-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: goal,
            activePlan: activePlan,
            chatHistory: chatHistory
          })
        });
        if (response.ok) {
          const resData = await response.json();
          if (resData && resData.id) {
            setCurrentPlanId(resData.id);
            planIdToUse = resData.id;
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("planId", resData.id);
            window.history.pushState({}, "", newUrl.toString());
          }
        }
      }

      if (planIdToUse) {
        const goalUrl = `${window.location.origin}${window.location.pathname}?planId=${planIdToUse}`;
        await navigator.clipboard.writeText(goalUrl);
        setIsGoalUrlCopied(true);
        setTimeout(() => setIsGoalUrlCopied(false), 2000);
        triggerToast(["⌥", "L"], "GOAL SHARE URL COPIED");
      } else {
        triggerToast(["WARN"], "SYNCING GOAL FAILED");
      }
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
      triggerToast(["WARN"], "COPY GOAL URL FAILED");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatMMSS = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Calculations
  const completedCount = activePlan?.tasks.filter(t => t.isCompleted).length || 0;
  const totalCount = activePlan?.tasks.length || 0;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filter and search logic for task tree
  const getFilteredTasks = () => {
    if (!activePlan) return [];
    return activePlan.tasks.filter(t => {
      // Milestone match
      if (focusedMilestone !== "ALL" && t.milestone !== focusedMilestone) return false;
      
      // Search match
      if (taskSearchQuery.trim()) {
        const q = taskSearchQuery.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(q);
        const descMatch = t.shortDescription.toLowerCase().includes(q);
        if (!titleMatch && !descMatch) return false;
      }
      
      // Priority match
      if (taskPriorityFilter !== "ALL" && t.priority !== taskPriorityFilter) return false;
      
      // Status match
      if (taskStatusFilter !== "ALL") {
        if (taskStatusFilter === "COMPLETED" && !t.isCompleted) return false;
        if (taskStatusFilter === "ACTIVE" && t.isCompleted) return false;
      }
      
      return true;
    });
  };

  const filteredTasks = getFilteredTasks();

  // STAGGER SEQUENTIAL ANIMATIONS FOR MAIN DASHBOARD LOAD
  const dashboardContainerVariants: any = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const renderPersistentOpsHub = () => {
    const completedDaily = dailyChecklist.filter(t => t.completed).length;
    const totalDaily = dailyChecklist.length;
    const dailyProgress = totalDaily > 0 ? Math.round((completedDaily / totalDaily) * 100) : 0;

    return (
      <div id="persistent_ops_hub" className="glass-card p-6 md:p-8 space-y-6 mt-8 select-none">
        <div className="pb-3 border-b border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black font-mono tracking-widest text-stone-950 uppercase flex flex-wrap items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              [03] PERSISTENT TACTICAL OPERATIONS HUB
            </h3>
            <p className="text-[10px] font-mono text-stone-400 uppercase mt-0.5">
              Always-on daily task checklist tracker for roadmap compliance
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-white/50 border border-white/40 text-stone-600 uppercase font-bold self-start sm:self-auto rounded-full">
            STATUS: ACTIVE
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] font-mono font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              ⚓ DAILY CHECKLIST ({completedDaily}/{totalDaily})
            </span>
            <span className="text-[10px] font-mono text-stone-500 font-bold">
              {dailyProgress}% COMPLETED
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-stone-100 border border-stone-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-stone-900 transition-all duration-300 ease-out"
              style={{ width: `${dailyProgress}%` }}
            />
          </div>

          {/* Add task form */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ADD DAILY CHECKLIST GOAL..."
              value={newDailyText}
              onChange={(e) => setNewDailyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddDailyTask();
                }
              }}
              className="flex-grow glass-input px-3 h-9 text-xs font-mono text-stone-900 focus:outline-none uppercase"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleAddDailyTask()}
              className="px-4 glass-btn-primary font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 cursor-pointer h-9"
            >
              [ADD]
            </motion.button>
          </div>

          {/* Presets */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[8px] font-mono text-stone-400 uppercase font-bold mr-1">QUICK SEED:</span>
            {[
              { label: "☀️ Morning Standup", text: "Morning standup & target review" },
              { label: "💻 Code Review", text: "Conduct code review & test suite execution" },
              { label: "📝 Log Sprint", text: "Document sprint milestones & achievements" },
              { label: "🧘 Deep Focus", text: "Complete 90-minute high-focus focus sprint" }
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleAddDailyTask(p.text)}
                className="text-[8.5px] font-mono px-2 py-0.5 bg-white/30 hover:bg-white/60 border border-white/20 text-stone-600 hover:text-stone-950 transition-all uppercase cursor-pointer rounded-lg"
              >
                + {p.label}
              </button>
            ))}
          </div>

          {/* List of items */}
          {dailyChecklist.length === 0 ? (
            <div className="p-6 border border-dashed border-stone-200 text-center font-mono text-[10px] text-stone-400 italic rounded-xl">
              Daily checklist is empty. Seed items above to track compliance.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {dailyChecklist.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2.5 border transition-all rounded-xl ${
                    item.completed
                      ? "bg-stone-55/40 border-stone-100/30 text-stone-400"
                      : "bg-white/40 border-white/30 hover:bg-white/60 text-stone-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => handleToggleDailyTask(item.id)}
                      className="w-4 h-4 border border-white/40 hover:border-stone-450 flex items-center justify-center bg-white/50 font-black cursor-pointer text-[10px] shrink-0 rounded"
                    >
                      {item.completed ? <Check className="w-3 h-3 text-stone-900" /> : null}
                    </button>
                    <span className={`text-xs font-mono break-words whitespace-normal leading-normal ${item.completed ? "line-through text-stone-400" : "font-semibold text-stone-900"}`}>
                      {item.text}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteDailyTask(item.id)}
                    className="text-stone-300 hover:text-red-600 font-mono text-[9px] uppercase tracking-widest shrink-0 cursor-pointer px-1 transition-colors"
                  >
                    [DEL]
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const dashboardItemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 380,
        damping: 28,
      },
    },
  };

  return (
    <div id="app_root" className="min-h-screen bg-transparent text-stone-900 flex flex-col font-sans selection:bg-stone-200 selection:text-stone-900 antialiased relative overflow-x-hidden">
      
      {/* Background Liquid Glass Ambient Blobs & LiquidEther */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-15%] w-[65vw] h-[65vw] rounded-full bg-indigo-300/10 mix-blend-multiply filter blur-[100px] md:blur-[140px] animate-blob" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-fuchsia-300/08 mix-blend-multiply filter blur-[100px] md:blur-[140px] animate-blob animation-delay-2000" />
        <div className="absolute top-[25%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-cyan-200/10 mix-blend-multiply filter blur-[100px] md:blur-[140px] animate-blob animation-delay-4000" />
        <div className="absolute bottom-[20%] left-[5%] w-[45vw] h-[45vw] rounded-full bg-amber-200/08 mix-blend-multiply filter blur-[100px] md:blur-[140px] animate-blob animation-delay-2000" />
        
        {/* Immersive React Bits LiquidEther Layer */}
        <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-screen">
          <LiquidEther
            colors={['#818cf8', '#f472b6', '#38bdf8']}
            mouseForce={15}
            cursorSize={80}
            isViscous={false}
            viscous={30}
            iterationsViscous={32}
            iterationsPoisson={24}
            resolution={0.4}
            isBounce={false}
            autoDemo={true}
            autoSpeed={0.3}
            autoIntensity={1.8}
            takeoverDuration={0.25}
            autoResumeDelay={3000}
            autoRampDuration={0.6}
          />
        </div>
      </div>

      {/* GUEST PRE-JOIN LOBBY INTERCEPT SCREEN */}
      {guestLobbyState?.active && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none">
          <div className="w-full max-w-md glass-panel p-8 relative">
            <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[8px] font-mono text-stone-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              LOBBY INTERCEPT
            </div>

            <div className="space-y-6">
              {/* Header */}
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-stone-900/90 backdrop-blur-md flex items-center justify-center font-mono font-bold text-white text-sm">
                  GH
                </div>
                <h2 className="text-sm font-bold tracking-[0.2em] text-stone-950 uppercase">
                  CO-OP TACTICAL ROOM
                </h2>
                {/* Dynamically display confirmation message identifying the owner's room */}
                <p className="text-xs font-mono text-stone-500 bg-white/40 border border-white/50 p-3 leading-relaxed rounded-xl font-semibold backdrop-blur-sm">
                  You are about to join <span className="text-stone-950 underline font-bold">{guestLobbyState.creatorNickname}</span>'s room
                </p>
              </div>

              {/* Nickname Input Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const targetNick = tempNicknameInput.trim().toUpperCase();
                  if (!targetNick) {
                    setLobbyError("CHOOSE A NICKNAME TO ACCESS CO-OP INTERFACE.");
                    return;
                  }

                  setIsLoading(true);
                  setLobbyError(null);

                  try {
                    const res = await fetch("/api/coop/join", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        roomCode: guestLobbyState.planId,
                        nickname: targetNick
                      })
                    });

                    if (!res.ok) {
                      const errObj = await res.json().catch(() => ({}));
                      throw new Error(errObj.error || "Room validation failed. Check room code.");
                    }

                    const resData = await res.json();
                    if (resData.success && resData.roomState) {
                      setNickname(targetNick);
                      localStorage.setItem("coop_nickname", targetNick);
                      setRoomCode(guestLobbyState.planId);
                      setRoomState(resData.roomState);
                      setCoopModeActive(true);
                      setIsHost(false);

                      // Set loaded plan details to workspace
                      setGoal(guestLobbyState.goal);
                      setActivePlan(guestLobbyState.activePlan);
                      setChatHistory(guestLobbyState.chatHistory);
                      setCurrentPlanId(guestLobbyState.planId);

                      triggerToast(["CONNECT"], "CONNECTED COCKPIT");
                      
                      // Clear intercept lobby state to allow workspace entry
                      setGuestLobbyState(null);
                    }
                  } catch (err: any) {
                    console.error("Failed to join co-op room via intercept:", err);
                    setLobbyError(err.message || "Unable to cross-link with co-op channel.");
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold text-stone-900 block uppercase tracking-widest">
                    [01] SELECT SQUAD CALLSIGN
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={14}
                      value={tempNicknameInput}
                      onChange={(e) => setTempNicknameInput(e.target.value.toUpperCase())}
                      placeholder="ENTER NICKNAME"
                      className="flex-grow h-10 glass-input px-3.5 font-mono text-xs focus:outline-none text-stone-900 placeholder-stone-400"
                    />
                    <button
                      type="button"
                      onClick={() => setTempNicknameInput(generateRandomCallsign())}
                      className="px-3 glass-btn-secondary text-[10px] font-mono uppercase cursor-pointer"
                      title="Generate Randomized Tactical Callsign"
                    >
                      [RAND]
                    </button>
                  </div>
                </div>

                {lobbyError && (
                  <p className="text-[10px] font-mono text-red-650 bg-red-50 border border-red-200 p-2.5 uppercase tracking-wide leading-relaxed rounded-xl">
                    [ERROR] {lobbyError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 glass-btn-primary font-mono font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? "[ESTABLISHING LINK...]" : "[SECURE CO-OP TRANSMISSION]"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

               {/* Back to Home / Sandbox fallback */}
              <div className="pt-2 border-t border-white/20 text-center">
                <button
                  type="button"
                  onClick={() => {
                    triggerWarningModal("Warning: Goal may be lost permanently.", () => {
                      // Reset to clean sandbox slate
                      setGuestLobbyState(null);
                      setGoal("");
                      setActivePlan(null);
                      setChatHistory([]);
                      setCurrentPlanId(null);
                      setCoopModeActive(false);
                      setRoomCode(null);
                      setRoomState(null);
                      setIsHost(false);
                      const newUrl = new URL(window.location.href);
                      newUrl.searchParams.delete("planId");
                      newUrl.searchParams.delete("room");
                      window.history.pushState({}, "", newUrl.pathname + newUrl.search);
                    });
                  }}
                  className="text-[10px] font-mono text-stone-400 hover:text-stone-950 uppercase tracking-widest cursor-pointer hover:underline"
                >
                  [DEPART LOBBY & RE-ROUTE TO SANDBOX]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HUD KEYBOARD SHORTCUTS DICTIONARY DIALOG */}
      <ShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* DYNAMIC HUDS TOAST SHORTCUT SYSTEMS */}
      <ShortcutToast toasts={toasts} />

      {/* ADMINISTRATIVE COCKPIT STATS OVERLAY */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl glass-panel flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="bg-stone-900/95 text-white p-4 font-mono flex items-center justify-between border-b border-white/10 shrink-0 select-none rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
                <span className="text-xs font-bold tracking-widest uppercase">ADMINISTRATIVE MONITOR COCKPIT</span>
              </div>
              <div className="flex items-center gap-2">
                {isAdminAuthenticated && (
                  <button
                    type="button"
                    onClick={() => fetchAdminStats()}
                    disabled={isAdminLoading}
                    className="p-1.5 bg-stone-800 border border-stone-700 hover:border-stone-500 hover:bg-stone-700 text-stone-200 hover:text-white transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer rounded-lg"
                  >
                    <RefreshCw className={`w-3 h-3 ${isAdminLoading ? "animate-spin" : ""}`} />
                    <span>REFRESH</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminOpen(false);
                    setIsAdminAuthenticated(false);
                    setAdminStats(null);
                    setAdminPasscode("");
                  }}
                  className="p-1 hover:bg-red-650 hover:text-white transition-colors cursor-pointer rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-grow bg-white/20 backdrop-blur-md rounded-b-2xl">
              {!isAdminAuthenticated ? (
                /* Authenticate Screen */
                <div className="max-w-md mx-auto my-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-white/60 border border-white/40 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Lock className="w-6 h-6 text-stone-800" />
                    </div>
                    <h3 className="font-mono text-xs font-extrabold tracking-widest text-stone-900 uppercase">ACCESS PERMISSION REQUIRED</h3>
                    <p className="font-mono text-[10px] text-stone-400 uppercase tracking-wider">
                      ADMINISTRATOR CREDENTIAL AUTHENTICATION
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      fetchAdminStats();
                    }}
                    className="space-y-4 bg-white/60 backdrop-blur-md border border-white/35 p-6 rounded-2xl shadow-sm"
                  >
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-widest block">
                        ADMIN PASSCODE
                      </label>
                      <input
                        type="password"
                        required
                        value={adminPasscode}
                        onChange={(e) => setAdminPasscode(e.target.value)}
                        placeholder="••••••••••••••"
                        className="w-full h-10 glass-input px-3 font-mono text-xs tracking-widest focus:outline-none text-stone-900"
                      />
                    </div>

                    {adminError && (
                      <p className="text-[10px] font-mono text-red-650 bg-red-50 border border-red-200 p-3 uppercase tracking-wide leading-relaxed rounded-xl">
                        ⚠️ ACCESS DENIED: {adminError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isAdminLoading}
                      className="w-full h-10 bg-stone-900 hover:bg-stone-800 text-white font-mono text-xs font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {isAdminLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>AUTHORIZING...</span>
                        </>
                      ) : (
                        <span>AUTHORIZE SESSION</span>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* Stats Dashboard Screen */
                <div className="space-y-6">
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass-card p-4">
                      <span className="text-[8px] font-mono font-extrabold tracking-wider text-stone-400 uppercase block">ACTIVE (LAST 1M)</span>
                      <strong className="text-2xl font-mono font-black text-stone-900">{adminStats?.activeUsers1m ?? 0}</strong>
                      <span className="text-[8px] font-mono text-stone-500 uppercase block mt-1">SESSIONS</span>
                    </div>
                    <div className="glass-card p-4">
                      <span className="text-[8px] font-mono font-extrabold tracking-wider text-stone-400 uppercase block">ACTIVE (LAST 15M)</span>
                      <strong className="text-2xl font-mono font-black text-emerald-600">{adminStats?.activeUsers15m ?? 0}</strong>
                      <span className="text-[8px] font-mono text-stone-500 uppercase block mt-1">UNIQUE PILOTS</span>
                    </div>
                    <div className="glass-card p-4">
                      <span className="text-[8px] font-mono font-extrabold tracking-wider text-stone-400 uppercase block">CO-OP ROOMS</span>
                      <strong className="text-2xl font-mono font-black text-stone-900">{adminStats?.totalLobbies ?? 0}</strong>
                      <span className="text-[8px] font-mono text-stone-500 uppercase block mt-1">LIVE HUD RADARS</span>
                    </div>
                    <div className="glass-card p-4">
                      <span className="text-[8px] font-mono font-extrabold tracking-wider text-stone-400 uppercase block">SHARED PLANS</span>
                      <strong className="text-2xl font-mono font-black text-stone-900">{adminStats?.totalSavedPlans ?? 0}</strong>
                      <span className="text-[8px] font-mono text-stone-500 uppercase block mt-1">STORED ROADMAPS</span>
                    </div>
                  </div>

                  {/* Active Users Table Section */}
                  <div className="space-y-2 bg-white border border-stone-200 p-4">
                    <div className="flex justify-between items-baseline border-b border-stone-100 pb-2">
                      <h4 className="font-mono text-[10px] font-extrabold tracking-widest text-stone-900 uppercase">ACTIVE USER SESSIONS (LAST 15 MINUTES)</h4>
                      <span className="text-[9px] font-mono text-stone-400">{adminStats?.activeUsersList?.length ?? 0} PRESENT</span>
                    </div>

                    <div className="overflow-x-auto max-h-60 overflow-y-auto border border-stone-100">
                      {(!adminStats?.activeUsersList || adminStats.activeUsersList.length === 0) ? (
                        <div className="p-8 text-center font-mono text-[10px] text-stone-400 uppercase">
                          No active user sessions detected.
                        </div>
                      ) : (
                        <table className="w-full text-left font-mono text-[10px] border-collapse">
                          <thead className="bg-stone-100 sticky top-0 border-b border-stone-200">
                            <tr>
                              <th className="p-2.5 font-bold text-stone-500 uppercase tracking-wider">PILOT CALLSIGN</th>
                              <th className="p-2.5 font-bold text-stone-500 uppercase tracking-wider">CLIENT TOKEN</th>
                              <th className="p-2.5 font-bold text-stone-500 uppercase tracking-wider">GOAL / ACTIVE STRATEGY</th>
                              <th className="p-2.5 font-bold text-stone-500 uppercase tracking-wider">ROOM</th>
                              <th className="p-2.5 font-bold text-stone-500 uppercase tracking-wider">LAST SEEN</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 bg-white">
                            {adminStats.activeUsersList.map((usr: any, idx: number) => (
                              <tr key={usr.clientId || idx} className="hover:bg-stone-50/50">
                                <td className="p-2.5 font-bold text-stone-900">
                                  {usr.nickname === "Anonymous Explorer" ? (
                                    <span className="text-stone-400 italic">[ANON EXPLORER]</span>
                                  ) : (
                                    <span className="text-stone-900">⚡ {usr.nickname}</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-stone-500 font-mono text-[9px] select-all">
                                  {usr.clientId?.substring(0, 15) || "Unknown"}...
                                </td>
                                <td className="p-2.5 text-stone-700 max-w-xs truncate" title={usr.goal || ""}>
                                  {usr.goal ? (
                                    <div>
                                      <div className="font-bold text-stone-900 text-[10px] truncate">{usr.goal}</div>
                                      {usr.activePlanTitle && (
                                        <div className="text-[9px] text-stone-500 truncate">Plan: {usr.activePlanTitle}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-stone-300 uppercase">[IDLE / EXPLORING]</span>
                                  )}
                                </td>
                                <td className="p-2.5">
                                  {usr.coOpRoom ? (
                                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-bold border border-amber-200">
                                      ROOM: {usr.coOpRoom}
                                    </span>
                                  ) : (
                                    <span className="text-stone-300 font-bold uppercase">[SANDBOX]</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-stone-500">
                                  {usr.lastSeenAgoSeconds === 0 ? "LIVE" : `${usr.lastSeenAgoSeconds}s ago`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Co-Working Lobbies Section */}
                  <div className="space-y-3 bg-white border border-stone-200 p-4">
                    <div className="flex justify-between items-baseline border-b border-stone-100 pb-2">
                      <h4 className="font-mono text-[10px] font-extrabold tracking-widest text-stone-900 uppercase">LIVE CO-WORKING LOBBIES (ACTIVE RADARS)</h4>
                      <span className="text-[9px] font-mono text-stone-400">{adminStats?.activeLobbies?.length ?? 0} ACTIVE ROOMS</span>
                    </div>

                    {(!adminStats?.activeLobbies || adminStats.activeLobbies.length === 0) ? (
                      <div className="p-8 text-center font-mono text-[10px] text-stone-400 uppercase border border-stone-100">
                        No active co-working lobbies currently deployed.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-60 overflow-y-auto">
                        {adminStats.activeLobbies.map((room: any) => (
                          <div key={room.roomCode} className="border border-stone-200 p-3 bg-stone-50/50 space-y-2">
                            <div className="flex justify-between items-start flex-wrap gap-2">
                              <div>
                                <span className="bg-stone-900 text-white font-bold px-2 py-0.5 text-[10px] tracking-widest font-mono">
                                  ROOM CODE: {room.roomCode}
                                </span>
                                <h5 className="font-bold text-[11px] text-stone-900 mt-1 uppercase">Goal: {room.goal || "Sandbox Session"}</h5>
                                {room.activePlanTitle && (
                                  <p className="text-[9px] text-stone-500 font-mono">Plan: {room.activePlanTitle}</p>
                                )}
                              </div>
                              <span className="text-[9px] bg-stone-200 text-stone-700 px-1.5 py-0.5 font-bold uppercase">
                                {room.playerCount} Team Member{room.playerCount === 1 ? "" : "s"}
                              </span>
                            </div>

                            {/* Players in this room */}
                            <div className="border-t border-stone-200 pt-2">
                              <span className="text-[8px] text-stone-400 uppercase font-bold tracking-widest block mb-1">RADAR MEMBERS:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {room.players.map((p: any) => (
                                  <div key={p.nickname} className="bg-white border border-stone-200 p-2 font-mono text-[9px] flex items-center justify-between">
                                    <div>
                                      <span className="font-bold text-stone-900">
                                        {p.nickname} {p.isHost && "👑"}
                                      </span>
                                      <div className="text-stone-500 truncate max-w-[150px]">{p.currentActivity}</div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${p.isFocused ? "bg-emerald-500" : "bg-stone-300"}`} title={p.isFocused ? "Focused Active" : "Away"} />
                                      <span className="bg-stone-100 text-stone-700 font-bold px-1 py-0.5 text-[8.5px] border border-stone-200">
                                        {p.completedPoints}/{p.totalPoints} Tasks
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* De-authorize & Timestamp Row */}
                  <div className="flex justify-between items-center flex-wrap gap-2 pt-2 border-t border-stone-200">
                    <span className="text-[9px] font-mono text-stone-400 uppercase">
                      Last Stream Refreshed: {adminStats?.timestamp ? new Date(adminStats.timestamp).toLocaleTimeString() : "Never"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminAuthenticated(false);
                        setAdminStats(null);
                        setAdminPasscode("");
                      }}
                      className="px-3 py-1.5 border border-red-200 hover:border-red-500 hover:bg-red-50 text-red-600 hover:text-red-700 font-mono text-[10px] font-bold uppercase cursor-pointer transition-all"
                    >
                      De-authorize Session
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* Footer control panel info */}
            <div className="bg-stone-100 border-t border-stone-200 px-6 py-3 font-mono text-[8.5px] text-stone-400 uppercase tracking-widest flex justify-between select-none shrink-0">
              <span>GoalHub Admin System v2.1.0</span>
              <span>Secure Session Hash Active</span>
            </div>

          </div>
        </div>
      )}

      {/* CRITICAL WARNING MODAL DIALOG */}
      {warningModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-sm glass-panel p-6 relative">
            <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[8px] font-mono text-red-600 font-extrabold animate-pulse">
              [CRITICAL ALERT]
            </div>
            
            <div className="space-y-5 text-center mt-2">
              <div className="w-12 h-12 rounded-full bg-red-100/60 text-red-600 flex items-center justify-center mx-auto border border-red-200">
                <span className="font-mono text-lg font-black">!</span>
              </div>
              
              <div className="space-y-1">
                <h4 className="text-sm font-mono font-bold uppercase tracking-wider text-stone-950">
                  SYSTEM OVERRIDE WARNING
                </h4>
                <p className="text-xs font-mono text-stone-600 bg-white/40 border border-white/50 p-3 font-semibold leading-relaxed rounded-xl">
                  {warningModalMessage}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setWarningModalOpen(false);
                    if (warningModalAction) warningModalAction();
                  }}
                  className="flex-1 h-9 bg-red-600/90 hover:bg-red-600 text-white font-mono font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  [CONFIRM ACTION]
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWarningModalOpen(false);
                    setWarningModalAction(null);
                  }}
                  className="flex-1 h-9 glass-btn-secondary text-stone-950 font-mono font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  [ABORT / CANCEL]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPLOSION CANVAS INSTANCES */}
      {bursts.map((b) => (
        <ParticleExplosion key={b.id} x={b.x} y={b.y} onComplete={() => removeBurst(b.id)} />
      ))}

      {/* CO-WORKING LOBBY TEMPORARY TOASTS */}
      {lobbyToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#121212] text-white font-mono text-[11px] tracking-widest uppercase border border-stone-800 shadow-xl px-6 py-3 flex items-center gap-3">
          <span>[!] ALERT:</span>
          <span>{lobbyToast}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <header className={`border-b border-white/40 bg-white/60 backdrop-blur-xl sticky top-0 z-40 px-4 md:px-8 transition-all duration-300 ease-in-out select-none flex flex-row items-center justify-between ${
        isScrolled
          ? "h-12 py-0 gap-0"
          : "min-h-[4rem] py-3 md:py-3 gap-3 flex-wrap md:flex-nowrap"
      }`}>
         <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center font-mono font-bold text-white text-xs tracking-wider shrink-0">
            GH
          </div>
          <div>
            <h1 className="text-xs tracking-[0.18em] font-bold text-stone-900 uppercase">
              GOALHUB.AI
            </h1>
            <p className="text-[9px] font-mono text-stone-400 tracking-widest uppercase">
              {coopModeActive ? `CO-OP RADAR LOBBY` : `TACTICAL ACTION MATRIX`}
            </p>
          </div>
        </div>

        {/* Co-Op status indicator in header */}
        {coopModeActive && roomCode && (
          <div className={`flex items-center gap-2.5 md:gap-4 bg-stone-50/50 transition-all ${
            isScrolled
              ? "border-0 py-0 h-full w-auto justify-start"
              : "border-t border-b md:border-t-0 md:border-b-0 border-stone-100 py-1 md:py-0 md:border-l md:border-r border-stone-200 h-auto md:h-full w-full md:w-auto justify-center md:justify-start"
          }`}>
            <span className="text-[9px] md:text-[10px] font-mono font-bold text-stone-900 bg-stone-200 px-2 py-0.5">
              ROOM: {roomCode}
            </span>
            <span className={`${isScrolled ? "hidden sm:inline" : "inline"} text-[9px] font-mono text-stone-500 uppercase tracking-wider`}>
              Pilot: <strong className="text-stone-950 font-bold">{nickname}</strong>
            </span>
            {isSyncComboActive() && (
              <span className="text-[9px] md:text-[10px] font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 py-0.5 px-1.5 md:px-2 tracking-widest animate-pulse flex items-center gap-1">
                <Flame className="w-3 h-3 md:w-3.5 md:h-3.5 fill-amber-500 text-amber-600" /> SYNC (2X)
              </span>
            )}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {!isScrolled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex flex-nowrap sm:flex-wrap items-center justify-center gap-2 overflow-hidden"
            >
              {/* Administrative Cockpit Terminal Access Shield */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setIsAdminOpen(true);
                  if (isAdminAuthenticated) {
                    fetchAdminStats();
                  }
                }}
                className={`p-1.5 border h-10 w-10 flex items-center justify-center cursor-pointer shrink-0 transition-all rounded-xl ${
                  isAdminAuthenticated
                    ? "border-emerald-400 bg-emerald-500/10 backdrop-blur-md hover:bg-emerald-500/20"
                    : "border-white/40 bg-white/50 backdrop-blur-md hover:border-stone-400 hover:bg-white/80"
                }`}
                title="Open Administrative Real-Time Cockpit Stats"
              >
                {isAdminAuthenticated ? (
                  <Shield className="w-4 h-4 text-emerald-600 animate-pulse" />
                ) : (
                  <Lock className="w-4 h-4 text-stone-600" />
                )}
              </motion.button>

              {/* Key icon button to toggle dictionary */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsHelpOpen((p) => !p)}
                className="p-1.5 border border-white/40 bg-white/50 backdrop-blur-md hover:border-stone-400 hover:bg-white/80 h-10 w-10 flex items-center justify-center cursor-pointer shrink-0 rounded-xl"
                title="Display Keyboard Shortcuts Dictionary [⌥K]"
              >
                <Keyboard className="w-4 h-4 text-stone-600" />
              </motion.button>

              {coopModeActive ? (
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCopyCoopUrl}
                    className="h-10 px-3 md:px-4 border border-white/50 bg-white/60 backdrop-blur-md hover:bg-white/80 hover:border-stone-400 text-stone-900 text-xs font-mono font-bold tracking-widest transition-all uppercase flex items-center gap-2 cursor-pointer select-none rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                    title="Copy the live Co-Working direct invitation link to share"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="font-extrabold tracking-widest hidden sm:inline">[COPY_COOP_LINK]</span>
                    <span className="font-extrabold tracking-widest inline sm:hidden">[COPY_LINK]</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLeaveLobby}
                    className="h-10 px-3 sm:px-4 md:px-5 border border-white/10 bg-stone-900/90 hover:bg-red-600/90 text-white hover:border-red-500 text-xs font-mono font-bold tracking-widest uppercase flex items-center justify-center cursor-pointer select-none rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  >
                    <span className="hidden sm:inline">[DISCONNECT_LOBBY]</span>
                    <span className="inline sm:hidden">[DISCONNECT]</span>
                  </motion.button>
                </div>
              ) : (
                activePlan && (
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <motion.button
                      whileHover={{ scale: 1.03, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleCopyGoalUrl}
                      className="h-10 px-3 md:px-4 border border-white/50 bg-white/60 backdrop-blur-md hover:bg-white/80 hover:border-stone-400 text-stone-900 text-xs font-mono font-bold tracking-widest transition-all uppercase flex items-center gap-2 cursor-pointer select-none rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                      title="Copy permanent shareable link of this roadmap plan"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="font-extrabold tracking-widest hidden sm:inline">{isGoalUrlCopied ? "[COPIED!]" : "[COPY_PLAN_LINK]"}</span>
                      <span className="font-extrabold tracking-widest inline sm:hidden">{isGoalUrlCopied ? "[COPIED]" : "[COPY_PLAN]"}</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.03, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleStartCoWorking}
                      className="h-10 px-3 sm:px-4 md:px-5 border border-white/50 bg-white/60 backdrop-blur-md hover:bg-white/80 hover:border-stone-400 text-stone-900 text-xs font-mono font-bold tracking-widest transition-all uppercase flex items-center gap-2 cursor-pointer select-none rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                      title="Initialize a live, synchronized co-working room for this goal roadmap"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-extrabold tracking-widest hidden sm:inline">[START_COWORKING]</span>
                      <span className="font-extrabold tracking-widest inline sm:hidden">[COWORKING]</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.03, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleResetWorkspace}
                      className="h-10 px-3 sm:px-4 md:px-5 border border-white/10 bg-stone-900/90 hover:bg-red-600/90 text-white hover:border-red-500 text-xs font-mono font-bold tracking-widest uppercase flex items-center justify-center cursor-pointer select-none rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="font-extrabold tracking-widest hidden sm:inline">[RESET_GOAL]</span>
                      <span className="font-extrabold tracking-widest inline sm:hidden">[RESET]</span>
                    </motion.button>
                  </div>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* WORKSPACE ROOT GRID CONTAINER */}
      <main className="flex-grow flex flex-col w-full">
        {!initialLoadFinished ? (
          <div className="flex-grow flex flex-col items-center justify-center font-mono space-y-4 select-none text-center py-32 bg-stone-50">
            <span className="text-stone-900 text-xs tracking-[0.25em] uppercase font-bold animate-pulse">
              [DECRYPTING CORE SCHEMATICS]
            </span>
            <span className="text-stone-400 text-[9px] tracking-widest uppercase">
              RESTORING STRATEGIC BLUEPRINT IN REAL-TIME...
            </span>
          </div>
        ) : !activePlan && !coopModeActive ? (
          
          /* ============================================
             VIEW 1: LANDING & INITIAL SETUP SCREEN
             ============================================ */
          <>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="max-w-[1300px] mx-auto px-4 py-8 md:py-16 flex-grow flex flex-col justify-center w-full"
            >
            {/* Header Title branding */}
            <div className="space-y-4 text-center mb-10">
              <div className="inline-block px-3 py-1 bg-white/50 backdrop-blur-md border border-white/40 text-[9px] font-mono text-stone-950 tracking-[0.18em] uppercase select-none font-bold rounded-full">
                TACTICAL CO-WORKING INTENSITY PORTAL
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-stone-950 tracking-tight uppercase leading-[1.05] font-sans">
                YOUR GOALS WITH<br />EXECUTION PLANS
              </h2>
              <p className="text-xs md:text-sm text-stone-500 max-w-xl mx-auto leading-relaxed font-mono">
                Model structured tactical roadmaps using our core models, or establish a joint cockpit workspace below to synchronize sprints with your colleague in real-time.
              </p>
            </div>

            {/* TWO-COLUMN INTRO LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto w-full">
              
              {/* Box 1 (7 Cols): Formulate New Strategic Roadmap */}
              <div className="lg:col-span-7 space-y-4">
                {planLoadError && (
                  <div className="bg-red-50 border border-red-200 p-4 text-xs font-mono uppercase text-red-700 flex flex-col gap-1 w-full rounded-xl">
                    <span className="font-bold underline">[ERROR ENCOUNTERED]:</span>
                    <span className="text-[10px] font-normal text-red-600 normal-case">{planLoadError}</span>
                  </div>
                )}
                <div className="glass-card p-6 md:p-8 space-y-6">
                  <div className="pb-3 border-b border-white/20">
                    <h3 className="text-xs font-bold font-mono tracking-widest text-stone-900 uppercase">
                      [01] FORMULATE NEW ROADMAP
                    </h3>
                    <p className="text-[10px] font-mono text-stone-400 uppercase">
                      Dissect your target ambition to step checklists
                    </p>
                  </div>

                  <form onSubmit={handleGeneratePlan} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono text-stone-500 uppercase tracking-widest block font-bold">
                        DECLARE TACTICAL OBJECTIVE
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={inputGoal}
                        onChange={(e) => setInputGoal(e.target.value)}
                        placeholder="e.g., Build Qwity UI v1 components in React. Implement responsive navigation nodes, custom dark modes, and modular tailwind states."
                        className="w-full glass-input text-xs font-sans text-stone-900 placeholder-stone-400 p-3 h-24 focus:outline-none transition-all leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-1">
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading || !inputGoal.trim()}
                        className="w-full sm:w-auto px-6 h-10 glass-btn-primary font-mono font-bold text-[10px] tracking-[0.18em] uppercase transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isLoading ? "[RE-FORMULATING...]" : "[FORMULATE QUEST ROADMAP]"}
                      </motion.button>

                      {isLoading && (
                        <span className="text-[9px] font-mono text-stone-400 tracking-wider animate-pulse uppercase">
                          INITIALIZING AI STRATEGIST...
                        </span>
                      )}
                    </div>
                  </form>

                  {/* Suggestions List */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[9px] font-mono text-stone-400 tracking-wider uppercase font-bold">
                      SUGGESTIONS FROM INTENSITY REGISTRY
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {[
                        "Beginner conversational Spanish language study",
                        "Build and deploy a secure SaaS pricing matrix UI",
                        "Complete 5K training road miles in 8 weeks",
                        "Refactor modular React library dependencies",
                      ].map((pill, idx) => (
                        <motion.button
                          key={idx}
                          whileHover={{ scale: 1.015, x: 2 }}
                          whileTap={{ scale: 0.995 }}
                          type="button"
                          onClick={() => handlePillClick(pill)}
                          className="bg-white/30 hover:bg-white/60 border border-white/25 text-left px-3 py-2 text-[10px] font-mono text-stone-600 hover:text-stone-950 transition-all cursor-pointer rounded-lg truncate"
                        >
                          {pill}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 2 (5 Cols): Co-Working Radar Lobbies (Zero-Login) */}
              <div className="lg:col-span-5 space-y-4">
                {lobbyError && (
                  <div className="bg-red-50 border border-red-200 p-4 text-xs font-mono uppercase text-red-700 flex flex-col gap-1 w-full">
                    <span className="font-bold underline">[ERROR ENCOUNTERED]:</span>
                    <span className="text-[10px] font-normal text-red-600 normal-case">{lobbyError}</span>
                  </div>
                )}
                <div id="coworking_radar_box" className="glass-card p-6 md:p-8 space-y-6 relative overflow-hidden">
                  
                  <div className="pb-3 border-b border-white/20">
                    <h3 className="text-xs font-bold font-mono tracking-widest text-[#121212] uppercase flex items-center gap-2">
                      [02] CO-WORKING RADAR
                    </h3>
                    <p className="text-[10px] font-mono text-stone-400 uppercase">
                      Connect two monitors in instant accountability
                    </p>
                  </div>

                {/* Temporary Nickname Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <label className="text-[9px] font-mono text-stone-500 uppercase tracking-widest block font-bold">
                      1. YOUR CALLSIGN / NICKNAME
                    </label>
                    <button
                      type="button"
                      onClick={() => setTempNicknameInput(generateRandomCallsign())}
                      className="text-[8.5px] font-mono text-stone-600 hover:text-stone-950 font-bold uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      🎲 [RANDOMIZE]
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={tempNicknameInput}
                    onChange={(e) => setTempNicknameInput(e.target.value)}
                    placeholder="e.g., DEV_NEO"
                    className="w-full glass-input text-xs font-mono text-stone-900 px-3 h-9 focus:outline-none uppercase"
                  />
                </div>

                <div className="border-t border-dashed border-white/20 my-4" />

                {/* Actions Grid */}
                <div className="space-y-4">
                  {/* Option A: Spawn New Room */}
                  <div className="space-y-2">
                    <span className="text-[8px] font-mono text-stone-400 uppercase tracking-widest block">
                      OPTION A: DESIGN ROADMAP AND ACTIVATE ROOM
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.015, y: -0.5 }}
                      whileTap={{ scale: 0.985 }}
                      type="button"
                      onClick={handleSpawnLobby}
                      className="w-full h-10 border border-white/50 bg-white/60 backdrop-blur-md hover:bg-white/85 text-stone-950 font-mono font-bold text-[10px] tracking-[0.16em] uppercase transition-all cursor-pointer rounded-xl shadow-sm hover:shadow-md"
                    >
                      [ + Spawn Co-Op Lobby ]
                    </motion.button>
                  </div>

                  {/* Option B: Enter Room Code */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[8px] font-mono text-stone-400 tracking-widest block uppercase">
                      OPTION B: JOIN WITH SQUAD CODE
                    </span>
                    <form onSubmit={handleJoinLobby} className="flex gap-2">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="ZAP9"
                        value={joinRoomCodeInput}
                        onChange={(e) => setJoinRoomCodeInput(e.target.value.toUpperCase())}
                        className="w-24 glass-input text-center font-mono text-xs text-stone-900 focus:outline-none h-9 uppercase"
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="flex-grow glass-btn-primary font-mono font-bold text-[9px] tracking-wider uppercase h-9 cursor-pointer"
                      >
                        [JOIN COCKPIT]
                      </motion.button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

          </div>



            {/* Guide strip */}
            <div className="mt-14 p-5 bg-stone-50 border border-stone-200 text-[10px] font-mono text-stone-500 max-w-4xl mx-auto w-full leading-relaxed">
              <p className="font-bold uppercase text-stone-700 mb-1">PROMPT GUIDELINES & SPECIFICATION MATRIX:</p>
              <p>
                By linking into Co-Working Radar lobbies, participants share an active Quest checklist map automatically. Keep your browser active. Tab switching flags list metrics in your partner's HUD and instantly dims dashboard intensity.
              </p>
            </div>
          </motion.div>
          
          {/* Persistent operations hub */}
          <div className="max-w-[1300px] mx-auto px-4 pb-12 w-full">
            {renderPersistentOpsHub()}
          </div>
        </>
        ) : (
          
          /* ============================================
             VIEW 2: DUAL-COCKPIT / SPLIT-SCREEN WORKSPACE
             ============================================ */
          <motion.div
            variants={dashboardContainerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 lg:grid-cols-12 flex-grow border-b border-white/20 bg-transparent min-h-[calc(100vh-64px)] overflow-hidden"
          >
            {/* ========================================================
               LEFT 60% (YOUR DOMAIN): QUEST MAP, TIMER, NON-NEGOTIABLES
               ======================================================== */}
            <div
              id="checklist_pane"
              ref={checklistPaneRef}
              className={`lg:col-span-8 border-r border-white/30 p-5 md:p-8 lg:p-10 space-y-8 flex flex-col bg-white/25 backdrop-blur-xl overflow-y-auto max-h-[calc(100vh-64px)] transition-all duration-200 ${
                shakeActive ? "animate-subtle-shake" : ""
              }`}
            >
              {/* Dynamic Alerts Banner */}
              {lobbyToast && (
                <div className="bg-[#121212] text-white p-3 font-mono text-[10px] tracking-widest uppercase flex items-center justify-between">
                  <span>[SQUAD_ALERT]: {lobbyToast}</span>
                  <button onClick={() => setLobbyToast(null)} className="text-white/40 hover:text-white cursor-pointer">[X]</button>
                </div>
              )}

              {/* PERSISTENT SHARE INTEGRATION COUPLER (WHEN LINK / PLAN ID / COOP IS ACTIVE) */}
              {(coopModeActive ? roomCode : currentPlanId) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50/75 border-2 border-amber-500/30 p-4 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs"
                >
                  <div className="absolute top-0 left-0 h-full w-1 bg-amber-500" />
                  <div className="space-y-1 flex-grow">
                    <span className="text-[9px] font-mono font-bold text-amber-800 tracking-wider uppercase block">
                      ⚡ {coopModeActive ? "LIVE CO-OP SESSION ACTIVE" : "SHARE LINK ACTIVE"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-stone-900 bg-white border border-stone-300 px-2 py-0.5 select-all break-all max-w-full inline-block">
                        {coopModeActive
                          ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
                          : `${window.location.origin}${window.location.pathname}?planId=${currentPlanId}`}
                      </span>
                    </div>
                    <p className="text-[9px] font-mono text-stone-500 uppercase leading-normal">
                      {coopModeActive
                        ? "Share this room link to let team members join your live interactive cockpit!"
                        : "Share this link with others to let them view your exact goal roadmap!"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        const targetUrl = coopModeActive
                          ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
                          : `${window.location.origin}${window.location.pathname}?planId=${currentPlanId}`;
                        try {
                          await navigator.clipboard.writeText(targetUrl);
                          triggerToast(["COPY"], "SHARE LINK COPIED");
                        } catch (err) {
                          console.warn(err);
                        }
                      }}
                      className="flex-1 md:flex-none h-8 px-3.5 bg-stone-900 hover:bg-stone-850 text-white font-mono font-bold text-[10px] tracking-wider uppercase border border-stone-900 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      [COPY LINK]
                    </button>
                    {(navigator as any).share && (
                      <button
                        type="button"
                        onClick={async () => {
                          const targetUrl = coopModeActive
                            ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
                            : `${window.location.origin}${window.location.pathname}?planId=${currentPlanId}`;
                          try {
                            await navigator.share({
                              title: activePlan?.planTitle || "Co-working Goal Roadmap",
                              text: coopModeActive
                                ? `Join my live co-working goal roadmap session for "${activePlan?.planTitle || goal}" on GoalHub!`
                                : `Check out my goal roadmap for "${activePlan?.planTitle || goal}" on GoalHub!`,
                              url: targetUrl
                            });
                          } catch (err) {
                            console.warn(err);
                          }
                        }}
                        className="flex-1 md:flex-none h-8 px-3.5 bg-white hover:bg-stone-50 text-stone-900 font-mono font-bold text-[10px] tracking-wider uppercase border border-stone-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3 h-3" />
                        [SHARE]
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Your Domain Master Header info */}
              {activePlan && (
                <motion.div
                  variants={dashboardItemVariants}
                  className="glass-card p-7 space-y-5 relative overflow-hidden"
                >
                  <div className="flex flex-col xl:flex-row justify-between items-start gap-4">
                    <div className="space-y-1.5 -mt-3">
                      <h3 className="text-xl md:text-2xl font-black text-stone-950 uppercase tracking-tight font-sans pt-0">
                        {activePlan.planTitle}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Meta properties */}
                  <div className="grid grid-cols-2 gap-5 text-xs font-mono border-t border-white/20 pt-3.5 text-stone-500 mt-2">
                    <div>
                      <span className="uppercase tracking-wider block text-[9px] text-stone-400 font-bold mb-0.5">Threat Difficulty</span>
                      <strong className="text-stone-900 uppercase text-xs">{activePlan.difficulty}</strong>
                    </div>
                    <div>
                      <span className="uppercase tracking-wider block text-[9px] text-stone-400 font-bold mb-0.5">Total Milestones</span>
                      <strong className="text-stone-900 uppercase text-xs">{activePlan.milestones.length} Phases</strong>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ========================================================
                 CO-OP WORKSPACE REAL-TIME HUB
                 ======================================================== */}
              {activePlan && (
                <motion.div
                  id="upgrade_radar_section"
                  variants={dashboardItemVariants}
                  className="glass-card p-6 md:p-8 relative overflow-hidden"
                >
                  {/* CO-OP COCKPIT SENSORS (ONLY SHOWS WHEN IN CO-OP MODE) */}
                  {coopModeActive && roomState && roomState.players ? (
                    <div className="space-y-4">
                      <span className="text-[10px] font-mono text-stone-950 uppercase tracking-[0.18em] block font-black flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        CO-OP SQUAD STATUS [ROOM: {roomCode}]
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.values(roomState.players).map((p: any) => {
                          const isSelf = p.nickname === nickname;
                          return (
                            <div 
                              key={p.nickname} 
                              className={`p-3 border font-mono text-xs flex flex-col justify-between gap-2 transition-all rounded-xl ${
                                isSelf 
                                  ? "bg-white/60 border-stone-950" 
                                  : "bg-white/25 border-white/30"
                              }`}
                            >
                              <div className="flex justify-between items-center border-b border-stone-100 pb-1.5">
                                <span className="font-extrabold text-stone-900 flex items-center gap-1.5">
                                  {isSelf ? "👤 [YOU]" : "👥 [SQUAD]"} {p.nickname}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[9px] text-stone-400 pt-1.5">
                                <span>Tasks: {p.completedPoints || 0}/{p.totalPoints || 0} Complete</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <span
                        onClick={handleUpgradeToCoWorking}
                        className="text-[10px] font-mono text-stone-950 hover:text-amber-600 active:text-amber-700 uppercase tracking-[0.18em] block font-black flex items-center gap-2 cursor-pointer transition-all duration-200 select-none group"
                        title="Click to save, copy link, and instantly launch Co-working Radar room"
                      >
                        <Users className="w-4 h-4 text-stone-850 group-hover:scale-110 group-hover:text-amber-600 transition-all duration-200" />
                        UPGRADE TO CO-WORKING RADAR
                        <span className="text-[8px] font-bold text-amber-500 bg-amber-50 border border-amber-200 px-1 py-0.5 ml-auto animate-pulse group-hover:scale-105 transition-all">
                          [⚡ ACTIVATE CO-OP]
                        </span>
                      </span>
                      <p className="text-[10px] font-mono text-stone-500 uppercase leading-relaxed">
                        Link this active workspace with a partner's screen in real-time. Share your task checklist live.
                      </p>

                      <div className="space-y-4 bg-stone-50 border border-stone-200 p-4">
                        {/* Callsign / Nickname selection */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-baseline">
                            <label className="text-[8px] font-mono text-stone-500 uppercase tracking-widest block font-bold">
                              YOUR CALLSIGN / NICKNAME
                            </label>
                            <button
                              type="button"
                              onClick={() => setTempNicknameInput(generateRandomCallsign())}
                              className="text-[8px] font-mono text-stone-600 hover:text-stone-950 font-bold uppercase tracking-wider cursor-pointer"
                            >
                              🎲 [RANDOMIZE]
                            </button>
                          </div>
                          <input
                            type="text"
                            required
                            maxLength={15}
                            value={tempNicknameInput}
                            onChange={(e) => setTempNicknameInput(e.target.value)}
                            placeholder="e.g., DEV_NEO"
                            className="w-full bg-white border border-stone-200 focus:border-stone-950 text-xs font-mono text-stone-900 px-3 h-8 focus:outline-none uppercase"
                          />
                        </div>

                        <div className="border-t border-dashed border-stone-200" />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                          {/* Option A: Spawn New Lobby */}
                          <div className="space-y-1.5">
                            <span className="text-[8.5px] font-mono text-stone-400 tracking-wider block font-bold uppercase">
                              Option A: Spawn Room
                            </span>
                            <motion.button
                              whileHover={{ scale: 1.015 }}
                              whileTap={{ scale: 0.985 }}
                              type="button"
                              onClick={handleSpawnLobby}
                              className="w-full h-8 bg-stone-950 text-white hover:bg-stone-850 font-mono font-bold text-[8.5px] tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Radio className="w-3.5 h-3.5 animate-pulse" />
                              [SPAWN CO-OP LOBBY]
                            </motion.button>
                          </div>

                          {/* Option B: Join Lobby */}
                          <div className="space-y-1.5">
                            <span className="text-[8.5px] font-mono text-stone-400 tracking-wider block font-bold uppercase">
                              Option B: Join Squad Room
                            </span>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                maxLength={4}
                                placeholder="CODE"
                                value={joinRoomCodeInput}
                                onChange={(e) => setJoinRoomCodeInput(e.target.value.toUpperCase())}
                                className="w-16 bg-white border border-stone-200 px-1 text-center text-xs font-mono text-stone-900 focus:border-stone-950 focus:outline-none h-8 uppercase"
                              />
                              <motion.button
                                whileHover={{ scale: 1.015 }}
                                whileTap={{ scale: 0.985 }}
                                type="button"
                                onClick={handleJoinLobby}
                                className="flex-grow h-8 bg-white border border-stone-900 hover:bg-stone-50 text-stone-900 font-mono font-bold text-[8.5px] uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                [JOIN]
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* FORMULATE QUEST ROADMAP (IF PLAN NOT YET GENERATED BUT CO-OP/LOBBY STARTED) */}
              {!activePlan && (
                <div className="bg-white border-2 border-stone-900 p-6 md:p-8 space-y-6 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-1.5 w-full bg-stone-900" />
                  
                  <div className="pb-3 border-b border-stone-100">
                    <h3 className="text-xs font-bold font-mono tracking-widest text-stone-900 uppercase">
                      [01] FORMULATE SQUAD CO-OP ROADMAP
                    </h3>
                    <p className="text-[10px] font-mono text-stone-400 uppercase">
                      Declare the shared target ambition for your co-op squad
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="bg-red-50 border border-red-200 p-4 text-xs font-mono uppercase text-red-700 flex flex-col gap-1 w-full">
                      <span className="font-bold underline">[ERROR ENCOUNTERED]:</span>
                      <span className="text-[10px] font-normal text-red-600 normal-case">{errorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleGeneratePlan} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono text-stone-500 uppercase tracking-widest block font-bold">
                        DECLARE TACTICAL OBJECTIVE
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={inputGoal}
                        onChange={(e) => setInputGoal(e.target.value)}
                        placeholder="e.g., Build Qwity UI v1 components in React. Implement responsive navigation nodes, custom dark modes, and modular tailwind states."
                        className="w-full bg-stone-50 border border-stone-200 focus:border-stone-950 text-xs font-sans text-stone-900 placeholder-stone-300 p-3 h-24 focus:outline-none transition-colors leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-1">
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading || !inputGoal.trim()}
                        className="w-full sm:w-auto px-6 h-10 bg-stone-950 text-white hover:bg-stone-850 font-mono font-bold text-[10px] tracking-[0.18em] uppercase transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isLoading ? "[FORMULATING...]" : "[FORMULATE SQUAD ROADMAP]"}
                      </motion.button>

                      {isLoading && (
                        <span className="text-[9px] font-mono text-stone-400 tracking-wider animate-pulse uppercase">
                          INITIALIZING AI STRATEGIST...
                        </span>
                      )}
                    </div>
                  </form>

                  {/* Suggestions List */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[9px] font-mono text-stone-400 tracking-wider uppercase font-bold">
                      SUGGESTIONS FROM INTENSITY REGISTRY
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {[
                        "Beginner conversational Spanish language study",
                        "Build and deploy a secure SaaS pricing matrix UI",
                        "Complete 5K training road miles in 8 weeks",
                        "Refactor modular React library dependencies",
                      ].map((pill, idx) => (
                        <motion.button
                          key={idx}
                          whileHover={{ scale: 1.015, x: 2 }}
                          whileTap={{ scale: 0.995 }}
                          type="button"
                          onClick={() => handlePillClick(pill)}
                          className="bg-stone-50 hover:bg-stone-100 border border-stone-100 text-left px-3 py-2 text-[10px] font-mono text-stone-600 hover:text-stone-950 transition-colors cursor-pointer truncate"
                        >
                          {pill}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================
                 DAILY NON-NEGOTIABLES / DAILY BOUNTIES UI OVERVIEW
                 ======================================================== */}
              {activePlan && (
                <motion.div
                  variants={dashboardItemVariants}
                  className={`bg-stone-50 border p-4 space-y-3 shadow-xs select-none transition-all duration-300 ${
                    focusMode ? "blur-[2.5px] opacity-25 scale-[0.985] brightness-[0.8] saturate-50 pointer-events-none md:pointer-events-auto" : "border-stone-200"
                  }`}
                >
                  <div className="flex justify-between items-baseline text-[10px] font-mono">
                    <span className="text-stone-900 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                      ⚓ DAILY NON-NEGOTIABLE BOUNTIES
                    </span>
                    <span className="text-stone-750 font-bold">
                      COMPLIANCE RATE: {progressPercentage}% COMPLETED ({completedCount}/{totalCount})
                    </span>
                  </div>

                  {/* Horizontal visual checklist progress timeline */}
                  <div className="w-full h-1 bg-stone-200 overflow-hidden relative">
                    <div 
                      className="h-full bg-stone-900 transition-all duration-300 ease-out"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  {/* Small inline list of items */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[10px] font-mono text-stone-600">
                    {activePlan.tasks.slice(0, 3).map((task) => (
                      <motion.div 
                        key={task.id} 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={(e) => handleToggleTask(task.id, e)}
                        className={`p-2 border cursor-pointer select-none truncate transition-all ${
                          task.isCompleted 
                            ? "bg-white/40 border-stone-200 text-stone-400 line-through" 
                            : "bg-white border-stone-300 hover:border-stone-900 text-stone-800 font-bold"
                        }`}
                      >
                        {task.isCompleted ? "[X] " : "[ ] "} {task.title}
                      </motion.div>
                    ))}
                    {totalCount > 3 && (
                      <div className="p-2 border bg-stone-100 border-stone-200 flex items-center justify-center text-[9px] uppercase tracking-wider text-stone-400 italic">
                        + {totalCount - 3} MORE CHECKLIST NODES DETECTED
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* PERSISTENT TACTICAL OPERATIONS HUB (TO-DO LIST / DAILY CHECKLIST) */}
              {renderPersistentOpsHub()}

              {/* ========================================================
                 INTERACTIVE FILTERS & TREE CONSOLE
                 ======================================================== */}
              {activePlan && (
                <motion.div
                  variants={dashboardItemVariants}
                  className={`bg-white border p-4 space-y-3 shadow-xs transition-all duration-300 ${
                    focusMode ? "blur-[2.5px] opacity-20 scale-[0.985] brightness-[0.8] saturate-50 pointer-events-none md:pointer-events-auto" : "border-stone-200"
                  }`}
                >
                  <div className="text-[9px] font-mono text-stone-400 tracking-widest uppercase font-bold flex items-center justify-between">
                    <span>SEARCH STRATEGY MATRIX</span>
                    <span className="text-[8px] font-normal lowercase">[⌥I to focus matrix]</span>
                  </div>
                  
                  {/* Search query input */}
                  <input
                    id="search_input_el"
                    type="text"
                    placeholder="SEARCH SPECIFIC STEP OR TACTIC..."
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 px-3 h-8 text-[11px] font-mono text-stone-900 focus:border-stone-950 focus:outline-none placeholder-stone-300"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    {/* Status selection */}
                    <div>
                      <span className="text-[8px] font-mono text-stone-400 block uppercase mb-1">Execution Status</span>
                      <select
                        value={taskStatusFilter}
                        onChange={(e: any) => setTaskStatusFilter(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 h-7 text-[9px] font-mono px-1 text-stone-700 focus:outline-none focus:border-stone-950"
                      >
                        <option value="ALL">ALL STEPS</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="COMPLETED">COMPLETED</option>
                      </select>
                    </div>

                    {/* Priority specs */}
                    <div>
                      <span className="text-[8px] font-mono text-stone-400 block uppercase mb-1">Step Priority</span>
                      <select
                        value={taskPriorityFilter}
                        onChange={(e: any) => setTaskPriorityFilter(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 h-7 text-[9px] font-mono px-1 text-stone-700 focus:outline-none focus:border-stone-950"
                      >
                        <option value="ALL">ALL PRIO</option>
                        <option value="High">HIGH STATUS</option>
                        <option value="Medium">MEDIUM STATUS</option>
                        <option value="Low">LOW STATUS</option>
                      </select>
                    </div>

                    {/* Milestone phases selector */}
                    <div>
                      <span className="text-[8px] font-mono text-stone-400 block uppercase mb-1">Strategy Phase</span>
                      <select
                        value={focusedMilestone}
                        onChange={(e: any) => setFocusedMilestone(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 h-7 text-[9px] font-mono px-1 text-stone-700 focus:outline-none focus:border-stone-950"
                      >
                        <option value="ALL">ALL PHASES</option>
                        {activePlan.milestones.map((mil, idx) => (
                          <option key={idx} value={mil}>PHASE {idx+1}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Reset filters */}
                  {(taskSearchQuery || taskStatusFilter !== "ALL" || taskPriorityFilter !== "ALL" || focusedMilestone !== "ALL") && (
                    <button
                      onClick={() => {
                        setTaskSearchQuery("");
                        setTaskStatusFilter("ALL");
                        setTaskPriorityFilter("ALL");
                        setFocusedMilestone("ALL");
                        triggerToast(["RESET"], "MATRIX FILTERS CLEARED");
                      }}
                      className="w-full text-center text-[8px] font-mono text-stone-400 hover:text-stone-900 uppercase tracking-widest pt-1 block border-t border-stone-100 hover:underline cursor-pointer"
                    >
                      [RESET_ALL_MATRIX_FILTER_FILTERS]
                    </button>
                  )}
                </motion.div>
              )}

              {/* Dynamic Task Node PARAMETER Editor */}
              {selectedTaskId && activePlan && (() => {
                const selectedTaskVal = activePlan.tasks.find(x => x.id === selectedTaskId);
                if (!selectedTaskVal) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="bg-stone-950 text-white p-5 border border-stone-800 space-y-4 shadow-xl z-10"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-stone-800">
                      <span className="text-[10px] font-mono text-stone-400 tracking-wider">
                        [EDIT TASK PARAMETER SPECIFICATIONS]
                      </span>
                      <button
                        onClick={() => setSelectedTaskId(null)}
                        className="text-[9px] font-mono text-stone-400 hover:text-white cursor-pointer"
                      >
                        [CLOSE]
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[8px] font-mono text-stone-400 block uppercase">Step Action Title</label>
                        <input
                          type="text"
                          value={editTaskTitle}
                          onChange={(e) => setEditTaskTitle(e.target.value)}
                          className="w-full bg-stone-900 border border-stone-800 p-2 text-white font-sans text-xs focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-mono text-stone-400 block uppercase">Tactic Operational Hint</label>
                        <textarea
                          rows={2}
                          value={editTaskDesc}
                          onChange={(e) => setEditTaskDesc(e.target.value)}
                          className="w-full bg-stone-900 border border-stone-800 p-2 text-white font-mono text-[10px] leading-relaxed focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[8px] font-mono text-stone-400 uppercase">Priority:</span>
                          {["Low", "Medium", "High"].map((prio) => (
                            <button
                              key={prio}
                              onClick={() => {
                                handleUpdateTaskPriority(selectedTaskId, prio);
                                if (activePlan) {
                                  setActivePlan({
                                    ...activePlan,
                                    tasks: activePlan.tasks.map(tsk => tsk.id === selectedTaskId ? { ...tsk, priority: prio } : tsk)
                                  });
                                }
                              }}
                              className={`px-1.5 py-0.5 font-mono text-[8px] uppercase border tracking-wider cursor-pointer ${
                                selectedTaskVal.priority === prio
                                  ? "bg-white text-black border-white font-bold"
                                  : "border-stone-800 text-stone-400 hover:text-white"
                              }`}
                            >
                              {prio}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[8px] font-mono text-stone-400 uppercase">Effort:</span>
                          {["Short", "Medium", "Long"].map((eff) => (
                            <button
                              key={eff}
                              type="button"
                              onClick={() => {
                                if (activePlan) {
                                  setActivePlan({
                                    ...activePlan,
                                    tasks: activePlan.tasks.map(tsk => tsk.id === selectedTaskId ? { ...tsk, estimatedEffort: eff } : tsk)
                                  });
                                }
                              }}
                              className={`px-1.5 py-0.5 font-mono text-[8px] uppercase border tracking-wider cursor-pointer ${
                                selectedTaskVal.estimatedEffort === eff
                                  ? "bg-white text-black border-white font-bold"
                                  : "border-stone-800 text-stone-400 hover:text-white"
                              }`}
                            >
                              {eff}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSaveEditedTask(selectedTaskId)}
                            className="bg-white text-black font-semibold font-mono text-[9px] px-3 py-1 hover:bg-stone-200 cursor-pointer"
                          >
                            [SAVE_CHANGES]
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Master Phases Checklist Items */}
              {activePlan && (
                <div className="space-y-5 flex-grow">
                  {activePlan.milestones
                    .filter(mil => focusedMilestone === "ALL" || mil === focusedMilestone)
                    .map((milestoneName, mIdx) => {
                      const originalMilestoneIndex = activePlan.milestones.indexOf(milestoneName);
                      const milestoneTasks = filteredTasks.filter(t => t.milestone === milestoneName);
                      const isAllDone = milestoneTasks.length > 0 && milestoneTasks.every(t => t.isCompleted);
                      
                      return (
                        <motion.div
                          variants={dashboardItemVariants}
                          key={mIdx}
                          className="glass-card p-5 space-y-3 relative"
                        >
                          {/* Milestone Header */}
                          <div className="flex justify-between items-center pb-2 border-b border-white/20 select-none">
                            <div>
                              <span className="text-[8px] font-mono text-stone-400 tracking-widest uppercase block font-bold">
                                PHASE {originalMilestoneIndex + 1}
                              </span>
                              <span className="text-xs font-extrabold text-stone-900 uppercase">
                                {milestoneName}
                              </span>
                            </div>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleTogglePhaseAll(milestoneName, !isAllDone)}
                              className="px-2 py-0.5 border border-white/40 text-stone-600 hover:text-stone-950 hover:border-stone-400 font-mono text-[8px] uppercase select-none cursor-pointer bg-white/50 rounded-md transition-all"
                            >
                              {isAllDone ? "[UNDO_PHASE]" : "[MARK_PHASE_COMPLETE]"}
                            </motion.button>
                          </div>

                          {/* Checklist details block */}
                          {milestoneTasks.length === 0 ? (
                            <div className="text-[10px] font-mono text-stone-400 italic py-3 text-center border border-dashed border-white/20 rounded-xl">
                              No active strategy tasks matching target filter matrix.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {milestoneTasks.map((task) => (
                                <motion.div
                                  layoutId={`task_item_${task.id}`}
                                  key={task.id}
                                  className={`group flex items-start justify-between p-2.5 gap-3 border transition-all rounded-xl ${
                                    task.isCompleted 
                                      ? "bg-stone-55/40 border-stone-100/20 text-stone-400" 
                                      : "bg-white/45 border-white/40 hover:bg-white/70 hover:border-stone-400 hover:shadow-sm text-stone-900"
                                  }`}
                                >
                                  {/* Custom Checkbox button */}
                                  <motion.button
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.92 }}
                                    type="button"
                                    onClick={(e) => handleToggleTask(task.id, e)}
                                    className="mt-0.5 font-mono text-xs font-black cursor-pointer select-none border border-white/40 hover:border-stone-400 w-5 h-5 flex items-center justify-center shrink-0 bg-white/50 rounded"
                                  >
                                    {task.isCompleted ? <Check className="w-3.5 h-3.5 text-stone-900" /> : null}
                                  </motion.button>

                                  {/* Title & description area */}
                                  <div 
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className="flex-1 min-w-0 space-y-0.5 select-none text-left cursor-pointer hover:opacity-80 transition-opacity"
                                    title="Click to view/edit parameters"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-[11px] font-sans font-bold leading-tight ${task.isCompleted ? "line-through text-stone-350" : "text-stone-900"}`}>
                                        {task.title}
                                      </span>
                                      <span className={`text-[7px] font-mono font-bold tracking-wider px-1 border uppercase ${
                                        task.priority === "High" 
                                          ? "text-red-750 border-red-200 bg-red-50" 
                                          : task.priority === "Medium"
                                          ? "text-amber-700 border-amber-200 bg-amber-50"
                                          : "text-stone-500 border-stone-250 bg-stone-50"
                                      }`}>
                                        {task.priority || "MEDIUM"}
                                      </span>
                                      {task.estimatedEffort && (
                                        <span className="text-[7px] font-mono font-bold tracking-wider px-1 border uppercase text-sky-700 border-sky-200 bg-sky-50">
                                          {task.estimatedEffort} Effort
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-[9px] font-mono leading-relaxed truncate ${task.isCompleted ? "text-stone-300" : "text-stone-550"}`}>
                                      {task.shortDescription || "No specifications configured."}
                                    </p>
                                  </div>

                                  {/* Parameters management row */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      type="button"
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="text-stone-300 hover:text-red-600 font-mono text-[8px] font-bold px-1 uppercase transition-colors shrink-0 cursor-pointer"
                                      title="Delete discrete task"
                                    >
                                      [DEL]
                                    </motion.button>
                                  </div>

                                </motion.div>
                              ))}
                            </div>
                          )}

                          {/* Add manual custom task node inline */}
                          <div className="bg-stone-50 border border-stone-200 p-1.5 flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="[+] QUICK ADD NEW CHECKLIST STEP ELEMENT..."
                              value={inlineTaskTitles[milestoneName] || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setInlineTaskTitles(prev => ({ ...prev, [milestoneName]: v }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleAddInlineTask(milestoneName);
                                }
                              }}
                              className="bg-white border border-stone-200 flex-grow text-[10px] font-mono h-7 px-2 placeholder-stone-300 text-stone-900 focus:outline-none focus:border-stone-950"
                            />
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              type="button"
                              onClick={() => handleAddInlineTask(milestoneName)}
                              className="h-7 px-3 bg-stone-900 hover:bg-stone-800 text-white font-mono text-[8px] font-bold uppercase transition-colors cursor-pointer"
                            >
                              [ADD]
                            </motion.button>
                          </div>

                        </motion.div>
                      );
                    })}
                </div>
              )}

              {/* No active plan fallback */}
              {!activePlan && (
                <div className="bg-stone-50 border border-stone-200 p-8 text-center font-mono text-xs text-stone-400">
                  NO ACTIVE GOAL SPECIFICATIONS CONFIGURED. GENERATE A ROADMAP OR WAIT FOR HOST TO DISPATCH DATA PARAMS.
                </div>
              )}

            </div>

            {/* ========================================================
               RIGHT 40% (THE SQUAD FEED / CHAT BLUEPRINT STATUS PANEL)
               ======================================================== */}
            <div
              id="blueprint_pane"
              className={`lg:col-span-4 flex flex-col justify-between bg-white/30 backdrop-blur-xl max-h-[calc(100vh-64px)] border-l border-white/20 transition-all duration-300 ${
                focusMode ? "blur-[2.5px] opacity-20 scale-[0.985] brightness-[0.8] saturate-50 pointer-events-none md:pointer-events-auto" : ""
              }`}
            >
              {/* Tactical Strategy Console Title */}
              <div className="h-12 border-b border-white/20 flex px-4 justify-between items-center shrink-0 bg-white/45 backdrop-blur-md select-none font-sans">
                <span className="text-[10px] font-mono text-stone-900 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-stone-600 animate-pulse" />
                  AI STRATEGY ADVISOR CONSOLE
                </span>

                {/* Copy lobby or plan link */}
                {activePlan && (currentPlanId || roomCode) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={coopModeActive ? handleCopyCoopUrl : handleCopyGoalUrl}
                    className="h-7 px-2 border border-stone-200 hover:border-stone-900 text-[8px] font-mono bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-1000 uppercase select-none font-bold cursor-pointer"
                  >
                    {coopModeActive ? "[COPY CO-OP LINK]" : "[COPY GOAL LINK]"}
                  </motion.button>
                )}
              </div>

              {/* DYNAMIC SCROLLBODY FEED PANEL */}
              <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4">
                
                {/* ========================================================
                   CHAT PANEL: ORIGINAL TACTICAL MARKDOWN & EXPERT CHAT
                   ======================================================== */}
                <div className="space-y-4 font-sans leading-relaxed text-xs text-stone-700">
                  
                  {/* Original Chat history */}
                  {chatHistory.length > 0 && (
                    <div className="space-y-3">
                      {chatHistory.map((chat, index) => (
                        <div 
                          key={index} 
                          className={`p-4 border rounded-2xl ${
                            chat.role === "user" 
                              ? "bg-white/40 border-white/40 text-stone-800 shadow-sm" 
                              : "glass-card text-stone-900 font-mono text-[11px] leading-relaxed"
                          }`}
                        >
                          <div className="flex justify-between items-baseline pb-1.5 mb-1.5 border-b border-dashed border-stone-100 text-[10px] font-mono text-stone-400">
                            <span className="font-bold uppercase tracking-wider">
                              {chat.role === "user" ? "[LOCAL_USER_CHAT]" : "[NEURAL_ADVISOR_LOG]"}
                            </span>
                            <span>{chat.timestamp}</span>
                          </div>
                          {chat.role === "assistant" ? (
                            <div className="markdown-body text-[11px] leading-relaxed select-text">
                              <Markdown>{chat.content}</Markdown>
                            </div>
                          ) : (
                            <p className="select-text uppercase tracking-normal text-stone-900 font-mono text-[11px]">
                              {chat.content}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rich strategy details display */}
                  {activePlan && activePlan.richPlanDetails && (
                    <div className="p-4 bg-stone-50 border border-stone-200 space-y-2 select-text">
                      <span className="font-mono text-[9px] text-stone-400 font-black block uppercase tracking-widest border-b border-stone-150 pb-1.5 mb-2 flex items-center gap-1">
                        <Terminal className="w-3.5 h-3.5 text-stone-500" /> MASTER TIMELINE GUIDE SPECS
                      </span>
                      <div className="markdown-body font-mono text-[10.5px] leading-relaxed text-stone-800">
                        <Markdown>{activePlan.richPlanDetails}</Markdown>
                      </div>
                    </div>
                  )}

                  {/* Element to auto-scroll to */}
                  <div ref={chatBottomRef} />

                </div>

              </div>

              {/* Chat Send console form */}
              <div className="p-4 border-t border-stone-250 bg-stone-50 flex flex-col gap-3 shrink-0">
                <span className="text-[8px] font-mono text-stone-400 block uppercase font-bold">
                  FINE-TUNE SPECS MATRIX & STRATEGIES
                </span>
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="INPUT CUSTOM STRATEGIC PARAMETER OR ASKS..."
                    disabled={isLoading || !activePlan}
                    className="bg-white border border-stone-200 flex-grow text-[10px] font-mono h-9 px-3 placeholder-stone-300 text-stone-900 focus:outline-none focus:border-stone-950 disabled:opacity-40"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading || !chatInput.trim() || !activePlan}
                    className="h-9 px-4 bg-stone-900 hover:bg-stone-850 text-white font-mono text-[9px] font-bold uppercase transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
                  >
                    [SEND]
                  </motion.button>
                </form>
                
                {/* Quick Tuning prompt presets */}
                {activePlan && (
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-stone-400 block uppercase tracking-wide">QUICK CHAT HOT-MODIFIERS:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        "Increase Phase 1 steps priority",
                        "Explain weekly routines",
                        "Add daily checkpoint habits",
                      ].map((tPreset, idx) => (
                        <button
                          key={idx}
                          onClick={() => triggerQuickPrompt(tPreset)}
                          className="text-[8.5px] font-mono px-2 py-1 bg-white border border-stone-200 hover:border-stone-900 text-stone-600 hover:text-stone-950 uppercase cursor-pointer"
                        >
                          + {tPreset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
