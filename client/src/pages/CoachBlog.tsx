import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Pin, Tag, Calendar, User, MessageSquare,
  Send, ArrowLeft, Trash2, Edit, X, Check, Layout as LayoutIcon, Circle, Move, Save,
  RotateCcw, ChevronRight, Info, Layers, Zap, Shield, Hand, Target, RefreshCw,
  Maximize2, Minimize2
} from "lucide-react";

const CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "TACTICS", label: "Tactics & Strategy" },
  { value: "TRAINING", label: "Training Tips" },
  { value: "MOTIVATION", label: "Motivation" },
  { value: "ANALYSIS", label: "Match Analysis" },
  { value: "FITNESS", label: "Fitness & Conditioning" },
  { value: "MENTAL", label: "Mental Game" },
];

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL: "bg-afrocat-white-10 text-afrocat-muted",
  TACTICS: "bg-blue-500/15 text-blue-400",
  TRAINING: "bg-afrocat-teal-soft text-afrocat-teal",
  MOTIVATION: "bg-afrocat-gold-soft text-afrocat-gold",
  ANALYSIS: "bg-purple-500/15 text-purple-400",
  FITNESS: "bg-green-500/15 text-green-400",
  MENTAL: "bg-pink-500/15 text-pink-400",
};

function roleBadgeColor(role: string) {
  switch (role) {
    case "ADMIN": return "bg-afrocat-gold/20 text-afrocat-gold border-afrocat-gold/30";
    case "COACH": return "bg-afrocat-teal/20 text-afrocat-teal border-afrocat-teal/30";
    case "MANAGER": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default: return "bg-afrocat-white-5 text-afrocat-muted border-afrocat-border";
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── COURT CONSTANTS ──────────────────────────────────────────────────────────
const CW = 600, CH = 400, NET = 298, PR = 17;
const OF = 248, OM = 150, OB = 55;   // Our x: front / 3m / back
const PF = 352, PB = 545;            // Opponent x: front / back
const YT = 72, YM = 200, YB = 328;  // Y: top / mid / bottom
const SZ = { x: 230, y: 308 };      // Setter zone (near Z2-3)

// Player colours
const SC = "#a855f7", OHC = "#14b8a6", MBC = "#f97316", OPC = "#d4a843", LC = "#64748b", OPPC = "#ef4444";

// Zone helper (zone 1-6)
const Z: Record<number,{x:number,y:number}> = {
  1:{x:OB,y:YB}, 2:{x:OF,y:YB}, 3:{x:OF,y:YM}, 4:{x:OF,y:YT}, 5:{x:OB,y:YT}, 6:{x:OB,y:YM}
};

interface LP { id:string; label:string; x:number; y:number; color:string; isOpp?:boolean }
interface LA { x1:number; y1:number; x2:number; y2:number; color:string; dashed?:boolean; label?:string }
interface LiveTactic { id:string; name:string; description:string; keyPoints:string[]; players:LP[]; arrows:LA[]; badge?:string }
interface TacticCat { id:string; name:string; icon:React.ReactNode; color:string; accentBg:string; tactics:LiveTactic[] }

// ─── TACTICS DATA ─────────────────────────────────────────────────────────────
const TACTIC_CATS: TacticCat[] = [
  {
    id:"rotations", name:"Rotations", icon:<RotateCcw size={14}/>,
    color:"text-purple-400", accentBg:"bg-purple-500/20 border-purple-400/40",
    tactics:[
      {
        id:"r1", name:"Rotation 1 — S Serves", badge:"R1",
        description:"Setter (S) is the server in Zone 1 (back right corner). After serving, S sprints to the setting zone near Zone 2–3.",
        keyPoints:[
          "S stands in Z1 (back-right) and serves",
          "OP is in front-left (Z4) — diagonal partner to S",
          "MB1 at Z2 (front-right) must overlap with S until serve",
          "Libero (L) replaces MB2 in Zone 6 for serve-receive",
          "After serve: S runs immediately to the Z2-3 setting zone",
        ],
        players:[
          {id:"OP", label:"OP", x:Z[4].x, y:Z[4].y, color:OPC},  // Z4 front-left
          {id:"OH1",label:"OH1",x:Z[3].x, y:Z[3].y, color:OHC},  // Z3 front-center
          {id:"MB1",label:"MB1",x:Z[2].x, y:Z[2].y, color:MBC},  // Z2 front-right
          {id:"OH2",label:"OH2",x:Z[5].x, y:Z[5].y, color:OHC},  // Z5 back-left
          {id:"L",  label:"L",  x:Z[6].x, y:Z[6].y, color:LC  },  // Z6 back-center (L replaces MB2)
          {id:"S",  label:"S★", x:Z[1].x, y:Z[1].y, color:SC  },  // Z1 back-right SERVES
        ],
        arrows:[
          {x1:Z[1].x, y1:Z[1].y, x2:SZ.x, y2:SZ.y, color:SC, label:"S runs to set"},
          {x1:SZ.x, y1:SZ.y, x2:Z[4].x+6, y2:Z[4].y+12, color:SC, dashed:true, label:"set→OP"},
        ]
      },
      {
        id:"r2", name:"Rotation 2 — S at Front-Right", badge:"R2",
        description:"Setter (S) is already in Zone 2 (front right, near the antenna). MB2 serves from Zone 1.",
        keyPoints:[
          "MB2 serves from Z1 (back-right)",
          "S is in Z2 (front-right) — already at the net, ready to set",
          "OH1 is in Z4 (front-left) for outside attack",
          "OP is in Z5 (back-left) — in back row this rotation",
          "After serve: S makes a small slide rightward to the antenna",
        ],
        players:[
          {id:"OH1",label:"OH1",x:Z[4].x, y:Z[4].y, color:OHC},  // Z4 front-left
          {id:"MB1",label:"MB1",x:Z[3].x, y:Z[3].y, color:MBC},  // Z3 front-center
          {id:"S",  label:"S",  x:Z[2].x, y:Z[2].y, color:SC  },  // Z2 front-right (SETS)
          {id:"OP", label:"OP", x:Z[5].x, y:Z[5].y, color:OPC},  // Z5 back-left
          {id:"L",  label:"L",  x:Z[6].x, y:Z[6].y, color:LC  },  // Z6 back-center
          {id:"MB2",label:"MB2★",x:Z[1].x, y:Z[1].y, color:MBC},  // Z1 back-right SERVES
        ],
        arrows:[
          {x1:Z[2].x, y1:Z[2].y, x2:Z[2].x+10, y2:Z[2].y-12, color:SC, label:"S slides to antenna"},
          {x1:Z[2].x+10, y1:Z[2].y-12, x2:Z[4].x+6, y2:Z[4].y+10, color:SC, dashed:true, label:"set→OH1"},
        ]
      },
      {
        id:"r3", name:"Rotation 3 — S at Front-Center", badge:"R3",
        description:"Setter (S) is in Zone 3 (front center). OH2 serves from Zone 1. S must slide to Z2 area to set.",
        keyPoints:[
          "OH2 serves from Z1 (back-right)",
          "S starts at Z3 (front-center) then slides to Z2 to set",
          "MB1 is at Z4 (front-left) — can run a fake quick to distract",
          "OP is in Z6 (back-center) — back row opposite",
          "After serve: S slides rightward along the net to the antenna",
        ],
        players:[
          {id:"MB1",label:"MB1",x:Z[4].x, y:Z[4].y, color:MBC},  // Z4 front-left
          {id:"S",  label:"S",  x:Z[3].x, y:Z[3].y, color:SC  },  // Z3 front-center
          {id:"MB2",label:"MB2",x:Z[2].x, y:Z[2].y, color:MBC},  // Z2 front-right
          {id:"OH1",label:"OH1",x:Z[5].x, y:Z[5].y, color:OHC},  // Z5 back-left
          {id:"OP", label:"OP", x:Z[6].x, y:Z[6].y, color:OPC},  // Z6 back-center
          {id:"OH2",label:"OH2★",x:Z[1].x, y:Z[1].y, color:OHC},  // Z1 back-right SERVES
        ],
        arrows:[
          {x1:Z[3].x, y1:Z[3].y, x2:Z[2].x+8, y2:Z[2].y-15, color:SC, label:"S slides to Z2"},
          {x1:Z[2].x+8, y1:Z[2].y-15, x2:Z[4].x+6, y2:Z[4].y+10, color:SC, dashed:true, label:"set→MB1"},
        ]
      },
      {
        id:"r4", name:"Rotation 4 — S at Front-Left", badge:"R4",
        description:"Setter (S) is in Zone 4 (front left). OP serves from Zone 1. S must make the LONGEST run to get to the setting zone.",
        keyPoints:[
          "OP serves from Z1 (back-right)",
          "S starts at Z4 (front-LEFT) — the most difficult setting rotation",
          "S must run diagonally across the front row to Z2 area",
          "MB2 at Z3 temporarily fills the middle while S runs",
          "After serve: S sprints the full width of the net to set from Z2",
        ],
        players:[
          {id:"S",  label:"S",  x:Z[4].x, y:Z[4].y, color:SC  },  // Z4 front-left
          {id:"MB2",label:"MB2",x:Z[3].x, y:Z[3].y, color:MBC},  // Z3 front-center
          {id:"OH2",label:"OH2",x:Z[2].x, y:Z[2].y, color:OHC},  // Z2 front-right
          {id:"MB1",label:"MB1",x:Z[5].x, y:Z[5].y, color:MBC},  // Z5 back-left
          {id:"OH1",label:"OH1",x:Z[6].x, y:Z[6].y, color:OHC},  // Z6 back-center
          {id:"OP", label:"OP★", x:Z[1].x, y:Z[1].y, color:OPC},  // Z1 back-right SERVES
        ],
        arrows:[
          {x1:Z[4].x, y1:Z[4].y, x2:SZ.x, y2:SZ.y, color:SC, label:"S LONG run"},
          {x1:SZ.x, y1:SZ.y, x2:Z[4].x+8, y2:Z[4].y+15, color:SC, dashed:true, label:"set→OH"},
        ]
      },
      {
        id:"r5", name:"Rotation 5 — S at Back-Left", badge:"R5",
        description:"Setter (S) is in Zone 5 (back left). OH1 serves from Zone 1. S must cross the full court diagonally to set.",
        keyPoints:[
          "OH1 serves from Z1 (back-right)",
          "S starts at Z5 (back-left) — long diagonal run needed",
          "S must pass behind OH1 (or in front if roles switched) to reach setting zone",
          "MB2 at Z4 and OH2 at Z3 occupy the front row",
          "After serve: S sprints diagonally to the Z2 setting zone near the net",
        ],
        players:[
          {id:"MB2",label:"MB2",x:Z[4].x, y:Z[4].y, color:MBC},  // Z4 front-left
          {id:"OH2",label:"OH2",x:Z[3].x, y:Z[3].y, color:OHC},  // Z3 front-center
          {id:"OP", label:"OP", x:Z[2].x, y:Z[2].y, color:OPC},  // Z2 front-right
          {id:"S",  label:"S",  x:Z[5].x, y:Z[5].y, color:SC  },  // Z5 back-left
          {id:"MB1",label:"MB1",x:Z[6].x, y:Z[6].y, color:MBC},  // Z6 back-center
          {id:"OH1",label:"OH1★",x:Z[1].x, y:Z[1].y, color:OHC},  // Z1 back-right SERVES
        ],
        arrows:[
          {x1:Z[5].x, y1:Z[5].y, x2:SZ.x, y2:SZ.y, color:SC, label:"S diagonal sprint"},
          {x1:SZ.x, y1:SZ.y, x2:Z[4].x+6, y2:Z[4].y+10, color:SC, dashed:true, label:"set→MB2"},
        ]
      },
      {
        id:"r6", name:"Rotation 6 — S at Back-Center", badge:"R6",
        description:"Setter (S) is in Zone 6 (back center). MB1 serves from Zone 1. S runs straight ahead to the setting zone.",
        keyPoints:[
          "MB1 serves from Z1 (back-right)",
          "S in Z6 (back-center) — runs straight toward Z2-3 to set",
          "Libero replaces MB1 once MB1 finishes serving (back row sub)",
          "OH2 and OP are in front row with OH1 at Z2",
          "After serve: S runs directly forward to the setting position near net",
        ],
        players:[
          {id:"OH2",label:"OH2",x:Z[4].x, y:Z[4].y, color:OHC},  // Z4 front-left
          {id:"OP", label:"OP", x:Z[3].x, y:Z[3].y, color:OPC},  // Z3 front-center
          {id:"OH1",label:"OH1",x:Z[2].x, y:Z[2].y, color:OHC},  // Z2 front-right
          {id:"MB2",label:"MB2",x:Z[5].x, y:Z[5].y, color:MBC},  // Z5 back-left
          {id:"S",  label:"S",  x:Z[6].x, y:Z[6].y, color:SC  },  // Z6 back-center
          {id:"MB1",label:"MB1★",x:Z[1].x, y:Z[1].y, color:MBC},  // Z1 back-right SERVES
        ],
        arrows:[
          {x1:Z[6].x, y1:Z[6].y, x2:SZ.x, y2:SZ.y, color:SC, label:"S runs forward"},
          {x1:SZ.x, y1:SZ.y, x2:Z[4].x+6, y2:Z[4].y+10, color:SC, dashed:true, label:"set→OH2"},
        ]
      },
    ]
  },
  {
    id:"defence", name:"Defence", icon:<Shield size={14}/>,
    color:"text-blue-400", accentBg:"bg-blue-500/20 border-blue-400/40",
    tactics:[
      {
        id:"perimeter", name:"Perimeter Defence", badge:"PERI",
        description:"Players cover the perimeter of the court. The middle stays open — dig from the edges.",
        keyPoints:["All 6 players cover the court boundary","Middle player (L) reads the attacker","Strong side deep player digs sharp cross","Weak side covers line attack"],
        players:[
          {id:"B1",label:"B1",x:OF+8,y:YT-4,color:MBC},{id:"B2",label:"B2",x:OF+8,y:YB+4,color:OHC},
          {id:"D1",label:"D1",x:OM,  y:YT-8,color:OHC},{id:"D2",label:"D2",x:OM,  y:YB+8,color:OPC},
          {id:"L", label:"L", x:OB+20,y:YM,  color:LC },{id:"S", label:"S", x:OB,  y:YB,  color:SC },
          {id:"A1",label:"ATK",x:PF,y:YT,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:PF,y1:YT,x2:OM-20,y2:YM+30,color:OPPC,dashed:true,label:"cross attack"},
          {x1:PF,y1:YT,x2:OF+25,y2:YT+10,color:"#f59e0b",dashed:true,label:"line attack"},
        ]
      },
      {
        id:"rotational", name:"Rotational Defence", badge:"ROT",
        description:"Players rotate after the block to cover the unprotected zones left by blockers.",
        keyPoints:["Blockers seal the net — others rotate to fill gaps","Opposite side of block is vulnerable — cover it","MB blocker swings to cover tip zone after block","Libero reads attacker and pre-positions"],
        players:[
          {id:"BL",label:"BL",x:OF+8,y:YT-4,color:MBC},{id:"BR",label:"BR",x:OF+8,y:YM,  color:OHC},
          {id:"D1",label:"D1",x:OM+10,y:YT+25,color:OHC},{id:"L", label:"L", x:OM,  y:YM+30,color:LC },
          {id:"D2",label:"D2",x:OB+15,y:YT,  color:OPC},{id:"S", label:"S", x:OB,  y:YB,  color:SC },
          {id:"A1",label:"ATK",x:PF,y:YT,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:PF,y1:YT,x2:OM-10,y2:YM,color:OPPC,dashed:true,label:"attack path"},
          {x1:OM+10,y1:YT+25,x2:OM-20,y2:YM-20,color:OHC,label:"D rotates"},
        ]
      },
      {
        id:"man-up", name:"Man-Up (6-Up)", badge:"6UP",
        description:"Libero moves up to zone 6 to cover tips and short balls. Back corners cover deep.",
        keyPoints:["L moves up to Z6 to cover short tips","Corner defenders cover deep cross and line","Best used against tip-heavy attackers","Front row blockers must commit to seal net"],
        players:[
          {id:"B1",label:"B1",x:OF+8,y:YT-4,color:MBC},{id:"B2",label:"B2",x:OF+8,y:YM,  color:OHC},
          {id:"L", label:"L", x:OM,  y:YM,  color:LC },{id:"D1",label:"D1",x:OB+10,y:YT,  color:OHC},
          {id:"D2",label:"D2",x:OB+10,y:YB,  color:OPC},{id:"S", label:"S", x:OB,  y:YM,  color:SC },
          {id:"A1",label:"ATK",x:PF,y:YM,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:PF,y1:YM,x2:OM+20,y2:YM+20,color:OPPC,dashed:true,label:"tip"},
          {x1:PF,y1:YM,x2:OB+20,y2:YT+15,color:OPPC,dashed:true,label:"cross"},
        ]
      },
      {
        id:"slide-cover", name:"Slide-Block Cover", badge:"SLIDE",
        description:"Middle blocker slides to assist outside blockers. Deep defenders cover the angle.",
        keyPoints:["MB reads the set and slides left or right","Outside blocker commits; MB seals the gap","Backrow rotates opposite to the slide direction","Libero stays central to read the deflection"],
        players:[
          {id:"OH",label:"OH",x:OF+8,y:YT-4,color:OHC},{id:"MB",label:"MB",x:OF+8,y:YT+35,color:MBC},
          {id:"OP",label:"OP",x:OF,  y:YB,  color:OPC},{id:"L", label:"L", x:OM,  y:YM,  color:LC },
          {id:"D1",label:"D1",x:OB+10,y:YT,  color:OHC},{id:"S", label:"S", x:OB,  y:YB,  color:SC },
          {id:"A1",label:"ATK",x:PF,y:YT,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:OF+8,y1:YM,x2:OF+8,y2:YT+30,color:MBC,label:"MB slides"},
          {x1:PF,y1:YT,x2:OB+20,y2:YT+20,color:OPPC,dashed:true,label:"attack"},
        ]
      },
    ]
  },
  {
    id:"blocking", name:"Blocking", icon:<Hand size={14}/>,
    color:"text-orange-400", accentBg:"bg-orange-500/20 border-orange-400/40",
    tactics:[
      {
        id:"solo", name:"Solo Block", badge:"SOLO",
        description:"Single blocker at the net. Other players focus on defence coverage.",
        keyPoints:["One blocker commits — doesn't over-expose","Other five players in deeper defensive positions","Ideal against weak or out-of-system attacks","Libero reads the angle from solo block"],
        players:[
          {id:"MB",label:"MB",x:OF+8,y:YM,  color:MBC},{id:"OH",label:"OH",x:OF-8,y:YT+10,color:OHC},
          {id:"OP",label:"OP",x:OF-8,y:YB+10,color:OPC},{id:"L", label:"L", x:OM,  y:YM,  color:LC },
          {id:"D1",label:"D1",x:OB+10,y:YT,  color:OHC},{id:"S", label:"S", x:OB,  y:YB,  color:SC },
          {id:"A1",label:"ATK",x:PF,y:YM,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:PF,y1:YM,x2:OM,y2:YM,color:OPPC,dashed:true,label:"attack"},
          {x1:OF+8,y1:YM,x2:OF+8,y2:YM-15,color:MBC,label:"MB jumps"},
        ]
      },
      {
        id:"double-left", name:"Double Block Left", badge:"2-L",
        description:"Middle Blocker + Outside Hitter close the left-side attack with a double block.",
        keyPoints:["MB reads the set early and slides to OH's side","OH leads the block — MB seals the gap","Opposite covers the line from the right","Libero digs the sharp cross-court ball"],
        players:[
          {id:"OH",label:"OH",x:OF+8,y:YT-4,color:OHC},{id:"MB",label:"MB",x:OF+8,y:YT+36,color:MBC},
          {id:"OP",label:"OP",x:OF-5,y:YB,  color:OPC},{id:"L", label:"L", x:OM,  y:YT+40,color:LC },
          {id:"D1",label:"D1",x:OB+10,y:YT,  color:OHC},{id:"S", label:"S", x:OB,  y:YB,  color:SC },
          {id:"A1",label:"ATK",x:PF,y:YT,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:PF,y1:YT,x2:OB+20,y2:YT+30,color:OPPC,dashed:true,label:"cross"},
          {x1:OF+8,y1:YM,x2:OF+8,y2:YT+30,color:MBC,label:"MB slides"},
        ]
      },
      {
        id:"double-right", name:"Double Block Right", badge:"2-R",
        description:"Middle Blocker + Opposite block the right-side attack together.",
        keyPoints:["OP leads block at right antenna","MB slides from center to assist OP","OH on left side drops off net for line defence","Libero covers short angle after the block"],
        players:[
          {id:"OP",label:"OP",x:OF+8,y:YB+4,color:OPC},{id:"MB",label:"MB",x:OF+8,y:YB-36,color:MBC},
          {id:"OH",label:"OH",x:OF-5,y:YT,  color:OHC},{id:"L", label:"L", x:OM,  y:YB-40,color:LC },
          {id:"D1",label:"D1",x:OB+10,y:YB,  color:OHC},{id:"S", label:"S", x:OB,  y:YM,  color:SC },
          {id:"A1",label:"ATK",x:PF,y:YB,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:PF,y1:YB,x2:OB+20,y2:YB-30,color:OPPC,dashed:true,label:"cross"},
          {x1:OF+8,y1:YM,x2:OF+8,y2:YB-30,color:MBC,label:"MB slides"},
        ]
      },
      {
        id:"triple", name:"Triple Block", badge:"3-MAN",
        description:"All three front-row players form a wall at the net. High-risk, high-reward.",
        keyPoints:["Used only when you're certain of the attack direction","All three blockers must jump together — timing is critical","Back row MUST cover tips — entire court behind is exposed","Libero moves up to cover any tips over the block"],
        players:[
          {id:"OH",label:"OH",x:OF+8,y:YT,  color:OHC},{id:"MB",label:"MB",x:OF+8,y:YM,  color:MBC},
          {id:"OP",label:"OP",x:OF+8,y:YB,  color:OPC},{id:"L", label:"L", x:OM,  y:YM,  color:LC },
          {id:"D1",label:"D1",x:OB+20,y:YT,  color:OHC},{id:"S", label:"S", x:OB+20,y:YB,  color:SC },
          {id:"A1",label:"ATK",x:PF,y:YM,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:PF,y1:YM,x2:NET+20,y2:YM,color:OPPC,dashed:true,label:"blocked!"},
          {x1:OM,y1:YM,x2:OM,y2:YM-20,color:LC,label:"L covers tip"},
        ]
      },
    ]
  },
  {
    id:"attack", name:"Attack Plays", icon:<Zap size={14}/>,
    color:"text-yellow-400", accentBg:"bg-yellow-500/20 border-yellow-400/40",
    tactics:[
      {
        id:"quick", name:"Quick Attack (1-ball)", badge:"QUICK",
        description:"Setter delivers a lightning-fast low set to MB at Zone 3. No time for blockers to react.",
        keyPoints:["MB starts approach before the pass even arrives","Set is only 30-50cm above the net","Requires excellent setter-MB timing and trust","Can be combined with OH fake approach to distract blockers"],
        players:[
          {id:"OH1",label:"OH1",x:OB+30,y:YT+20,color:OHC},{id:"MB",label:"MB",x:OM+30,y:YM-20,color:MBC},
          {id:"OP", label:"OP", x:OF,  y:YB,  color:OPC},{id:"S", label:"S", x:SZ.x,y:SZ.y,color:SC },
          {id:"L",  label:"L",  x:OB,  y:YM,  color:LC },{id:"OH2",label:"OH2",x:OB,y:YT,color:OHC},
          {id:"B1",label:"OB1",x:PF,y:YT,color:OPPC,isOpp:true},{id:"B2",label:"OB2",x:PF,y:YM,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:SZ.x,y1:SZ.y,x2:OF-10,y2:YM-8,color:SC,label:"quick set"},
          {x1:OF-10,y1:YM-8,x2:NET+30,y2:YM,color:MBC,label:"MB kills"},
        ]
      },
      {
        id:"outside", name:"Outside Attack (Z4)", badge:"OH4",
        description:"Classic high-ball set to Outside Hitter at Zone 4. The most common volleyball attack.",
        keyPoints:["Passer to setter to outside — the standard sequence","OH1 approaches from behind the 3m line","High set gives OH time to adjust approach","Setter must identify if MB or OP is better option first"],
        players:[
          {id:"OH1",label:"OH1",x:OB+20,y:YT+15,color:OHC},{id:"MB", label:"MB", x:OF-20,y:YM,  color:MBC},
          {id:"OP", label:"OP", x:OF,  y:YB,  color:OPC},{id:"S",  label:"S",  x:SZ.x,y:SZ.y,color:SC },
          {id:"L",  label:"L",  x:OM,  y:YM+30,color:LC },{id:"OH2",label:"OH2",x:OB,  y:YT,  color:OHC},
        ],
        arrows:[
          {x1:SZ.x,y1:SZ.y,x2:OF-5,y2:YT+10,color:SC,label:"high set Z4"},
          {x1:OF-5,y1:YT+10,x2:NET+30,y2:YT+20,color:OHC,label:"OH kills"},
          {x1:OB+20,y1:YT+15,x2:OF-5,y2:YT+10,color:OHC,dashed:true,label:"approach"},
        ]
      },
      {
        id:"pipe", name:"Pipe Attack (Back Row)", badge:"PIPE",
        description:"Back-row player attacks from Zone 6 (pipe). Creates a 4th attack option.",
        keyPoints:["Player in Z6 approaches from behind the 3m line","Must jump and hit before landing on 3m line","Creates overload — blockers can only cover 3 front positions","Often used by OH2 or OP from the back row"],
        players:[
          {id:"OH1",label:"OH1",x:OF,  y:YT,  color:OHC},{id:"MB", label:"MB", x:OF,  y:YM,  color:MBC},
          {id:"OP", label:"OP", x:OF,  y:YB,  color:OPC},{id:"S",  label:"S",  x:SZ.x,y:SZ.y,color:SC },
          {id:"L",  label:"L",  x:OB,  y:YT,  color:LC },{id:"PIPE",label:"PIPE",x:OM-10,y:YM,color:OHC},
        ],
        arrows:[
          {x1:SZ.x,y1:SZ.y,x2:OM+10,y2:YM-10,color:SC,label:"back-set pipe"},
          {x1:OM+10,y1:YM-10,x2:NET+30,y2:YM,color:OHC,label:"pipe kill"},
          {x1:OB,y1:YM,x2:OM-10,y2:YM,color:OHC,dashed:true,label:"approach"},
        ]
      },
      {
        id:"combo", name:"Combo Play (Fake + Attack)", badge:"COMBO",
        description:"OH1 fakes a quick attack to draw blockers, MB attacks the other side.",
        keyPoints:["OH1 makes a fake approach to pull the MB blocker","Setter then sets MB on the opposite side","Requires split-second setter decision","Most effective when opponents over-commit to OH1"],
        players:[
          {id:"OH1",label:"OH1",x:OM,  y:YT+15,color:OHC},{id:"MB", label:"MB", x:OM+20,y:YB-15,color:MBC},
          {id:"OP", label:"OP", x:OF,  y:YB,  color:OPC},{id:"S",  label:"S",  x:SZ.x,y:SZ.y,color:SC },
          {id:"L",  label:"L",  x:OB,  y:YM,  color:LC },{id:"OH2",label:"OH2",x:OB,  y:YT,  color:OHC},
          {id:"B1",label:"OB1",x:PF,y:YT,color:OPPC,isOpp:true},
        ],
        arrows:[
          {x1:OM,y1:YT+15,x2:OF,y2:YT+5,color:OHC,dashed:true,label:"fake"},
          {x1:SZ.x,y1:SZ.y,x2:OF-5,y2:YB-10,color:SC,label:"set MB"},
          {x1:OM+20,y1:YB-15,x2:OF-5,y2:YB-10,color:MBC,dashed:true,label:"MB approach"},
          {x1:OF-5,y1:YB-10,x2:NET+30,y2:YB-10,color:MBC,label:"MB kills"},
        ]
      },
    ]
  },
  {
    id:"receive", name:"Serve Receive", icon:<Target size={14}/>,
    color:"text-green-400", accentBg:"bg-green-500/20 border-green-400/40",
    tactics:[
      {
        id:"w-form", name:"W-Formation (5-passer)", badge:"W",
        description:"Five players in a W shape. Standard serve receive — covers the most court.",
        keyPoints:["5 passers spread in a W shape across the court","Setter moves to net position immediately after serve","Middle back is usually the Libero","Each passer owns a clear zone — no crossing"],
        players:[
          {id:"P1",label:"OH1",x:OB+30,y:YT+20,color:OHC},{id:"P2",label:"MB1",x:OM,  y:YT+30,color:MBC},
          {id:"P3",label:"L",  x:OB+15,y:YM,  color:LC },{id:"P4",label:"MB2",x:OM,  y:YB-30,color:MBC},
          {id:"P5",label:"OH2",x:OB+30,y:YB-20,color:OHC},{id:"S", label:"S",  x:OF,  y:YB,  color:SC },
        ],
        arrows:[
          {x1:OB-10,y1:YT-15,x2:OB+30,y2:YT+20,color:"#facc15",dashed:true,label:"serve"},
          {x1:OB-10,y1:YT-15,x2:OB+15,y2:YM,  color:"#facc15",dashed:true},
          {x1:OF,y1:YB,x2:OF,y2:YB-25,color:SC,label:"S to net"},
        ]
      },
      {
        id:"cup", name:"Cup Formation (3-passer)", badge:"CUP",
        description:"Only 3 passers receive — typically the two OHs and Libero. Setter and MBs are free.",
        keyPoints:["Setter is FREE — doesn't receive serve","MBs don't receive — save energy for attacking","3 passers cover wider zones each","Used when you trust your passers' platform"],
        players:[
          {id:"P1",label:"OH1",x:OB+20,y:YT+15,color:OHC},
          {id:"P2",label:"L",  x:OB+10,y:YM,  color:LC },
          {id:"P3",label:"OH2",x:OB+20,y:YB-15,color:OHC},
          {id:"MB1",label:"MB1",x:OF-10,y:YT+20,color:MBC},{id:"MB2",label:"MB2",x:OF-10,y:YB-20,color:MBC},
          {id:"S",  label:"S",  x:OF,  y:YB,  color:SC },
        ],
        arrows:[
          {x1:OB-10,y1:YM,x2:OB+10,y2:YM,color:"#facc15",dashed:true,label:"serve"},
          {x1:OF,y1:YB,x2:OF+5,y2:YB-20,color:SC,label:"S to net"},
        ]
      },
      {
        id:"stack", name:"2-1-2 Stack", badge:"2-1-2",
        description:"Two receivers on each side, one in the middle. Common against jump servers.",
        keyPoints:["Two passers on left wing, two on right wing","Middle passer (L) is the safety net","Avoids seams in the passing formation","Strong against serves aimed at the sidelines"],
        players:[
          {id:"P1",label:"OH1",x:OB+30,y:YT+5,color:OHC},{id:"P2",label:"MB1",x:OB+25,y:YT+40,color:MBC},
          {id:"P3",label:"L",  x:OB+10,y:YM,  color:LC },
          {id:"P4",label:"MB2",x:OB+25,y:YB-40,color:MBC},{id:"P5",label:"OH2",x:OB+30,y:YB-5,color:OHC},
          {id:"S",  label:"S",  x:OF,  y:YB,  color:SC },
        ],
        arrows:[
          {x1:OB-10,y1:YT,x2:OB+30,y2:YT+5,color:"#facc15",dashed:true,label:"serve"},
          {x1:OB-10,y1:YB,x2:OB+30,y2:YB-5,color:"#facc15",dashed:true},
        ]
      },
    ]
  },
];

// ─── FREE BOARD DEFAULTS ───────────────────────────────────────────────────────
const COURT_W = 600, COURT_H = 400, PLAYER_R = 18;
const DEFAULT_POSITIONS = [
  { x: 60, y: 70,  label: "OH1" }, { x: 60, y: 200, label: "MB1" }, { x: 60, y: 330, label: "OP" },
  { x: 248, y: 70, label: "OH2" }, { x: 248, y: 200, label: "MB2" }, { x: 248, y: 330, label: "S" },
];

// ─── LIVE TACTICS COURT SVG ────────────────────────────────────────────────────
function LiveCourtSVG({ players, arrows }: { players: LP[]; arrows: LA[] }) {
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ touchAction: "none" }}>
      <defs>
        <marker id="arr-main" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#facc15" />
        </marker>
        <marker id="arr-s" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={SC} />
        </marker>
        <marker id="arr-oh" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={OHC} />
        </marker>
        <marker id="arr-mb" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={MBC} />
        </marker>
        <marker id="arr-opp" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={OPPC} />
        </marker>
        <marker id="arr-gold" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#facc15" />
        </marker>
      </defs>

      {/* Court background */}
      <rect width={CW} height={CH} fill="#0d2218" />

      {/* Our half */}
      <rect x={8} y={8} width={NET-12} height={CH-16} fill="#0f2e1c" stroke="#22c55e" strokeWidth={1.5} strokeOpacity={0.45} rx={4} />
      {/* Opponent half */}
      <rect x={NET+4} y={8} width={CW-NET-12} height={CH-16} fill="#1a1210" stroke="#ef4444" strokeWidth={1.5} strokeOpacity={0.35} rx={4} />

      {/* 3m attack lines */}
      <line x1={OM} y1={10} x2={OM} y2={CH-10} stroke="#22c55e" strokeWidth={1} strokeOpacity={0.3} strokeDasharray="6,4" />
      <line x1={CW-OM} y1={10} x2={CW-OM} y2={CH-10} stroke="#ef4444" strokeWidth={1} strokeOpacity={0.25} strokeDasharray="6,4" />

      {/* Net */}
      <rect x={NET-3} y={4} width={6} height={CH-8} fill="#6b7280" rx={2} />
      <line x1={NET} y1={4} x2={NET} y2={CH-4} stroke="#d1d5db" strokeWidth={1.5} strokeOpacity={0.7} />
      {/* Net posts */}
      <circle cx={NET} cy={6} r={4} fill="#9ca3af" />
      <circle cx={NET} cy={CH-6} r={4} fill="#9ca3af" />

      {/* Zone numbers (our half, small) */}
      {([1,2,3,4,5,6] as const).map(z => (
        <text key={z} x={Z[z].x} y={z<=3?Z[z].y+38:Z[z].y-24} textAnchor="middle"
          fill="#4ade80" fontSize={9} opacity={0.35} fontWeight="bold">Z{z}</text>
      ))}

      {/* Labels */}
      <text x={60} y={CH/2} textAnchor="middle" fill="#22c55e" fontSize={10} fontWeight="bold" opacity={0.5}
        transform={`rotate(-90 60 ${CH/2})`}>OUR TEAM</text>
      <text x={CW-30} y={CH/2} textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight="bold" opacity={0.4}
        transform={`rotate(90 ${CW-30} ${CH/2})`}>OPPONENTS</text>

      {/* Arrows */}
      {arrows.map((a, i) => {
        const arrowColor = a.color;
        const markerId = a.color === SC ? "arr-s" : a.color === OHC ? "arr-oh" : a.color === MBC ? "arr-mb" : a.color === OPPC ? "arr-opp" : "arr-gold";
        return (
          <g key={`a${i}`}>
            <line
              x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke={arrowColor} strokeWidth={a.dashed ? 1.5 : 2}
              strokeDasharray={a.dashed ? "5,4" : undefined}
              markerEnd={`url(#${markerId})`}
              opacity={0.85}
            />
            {a.label && (
              <text
                x={(a.x1+a.x2)/2} y={(a.y1+a.y2)/2 - 6}
                textAnchor="middle" fill={arrowColor} fontSize={8} fontWeight="bold" opacity={0.9}
              >{a.label}</text>
            )}
          </g>
        );
      })}

      {/* Players */}
      {players.map((p) => (
        <g key={p.id} style={{ transition: "transform 0.55s cubic-bezier(0.34,1.56,0.64,1)", transform: `translate(${p.x}px,${p.y}px)` }}>
          <circle cx={0} cy={0} r={PR} fill={p.color} stroke={p.isOpp ? "#fca5a5" : "#fff"} strokeWidth={p.isOpp ? 1.5 : 2} opacity={0.92} />
          {p.isOpp && <circle cx={0} cy={0} r={PR+3} fill="none" stroke={OPPC} strokeWidth={1} opacity={0.4} strokeDasharray="3,2" />}
          <text x={0} y={4} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── MAIN TACTIC BOARD SECTION ─────────────────────────────────────────────────
function TacticBoardSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canEdit = user?.isSuperAdmin || ["ADMIN", "MANAGER", "COACH"].includes(user?.role || "");

  // Board mode: live tactics or free draw
  const [boardMode, setBoardMode] = useState<"live" | "free">("live");

  // ── Live tactics state ──
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeTacticId, setActiveTacticId] = useState<string | null>(null);
  const [liveArrows, setLiveArrows] = useState<LA[]>([]);
  const [livePlayers, setLivePlayers] = useState<LP[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const courtContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      courtContainerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  const activeCat = TACTIC_CATS.find(c => c.id === activeCatId) ?? null;
  const activeTactic = activeCat?.tactics.find(t => t.id === activeTacticId) ?? null;

  function selectCategory(catId: string) {
    if (activeCatId === catId) { setActiveCatId(null); setActiveTacticId(null); return; }
    setActiveCatId(catId);
    setActiveTacticId(null);
    setLivePlayers([]);
    setLiveArrows([]);
  }

  function selectTactic(tactic: LiveTactic) {
    setActiveTacticId(tactic.id);
    // Slight delay so React can render the empty positions first, making animation visible
    setTimeout(() => {
      setLivePlayers(tactic.players);
      setLiveArrows(tactic.arrows);
    }, 60);
  }

  // ── Free board state ──
  const [activeBoard, setActiveBoard] = useState<any>(null);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [boardTitle, setBoardTitle] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<{x1:number;y1:number;x2:number;y2:number}[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{x:number;y:number}|null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const [teamId, setTeamId] = useState("");

  const { data: fetchedBoards = [] } = useQuery({
    queryKey: ["/api/tactic-boards", teamId],
    queryFn: () => api.getTacticBoards(teamId || undefined),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const boardJson = { positions, annotations };
      if (activeBoard?.id) return api.updateTacticBoard(activeBoard.id, { title: boardTitle, boardJson });
      return api.createTacticBoard({ title: boardTitle || "Untitled", boardJson, teamId: teamId || undefined });
    },
    onSuccess: () => { toast({ title: "Tactic board saved" }); qc.invalidateQueries({ queryKey: ["/api/tactic-boards", teamId] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteTacticBoard(id),
    onSuccess: () => { toast({ title: "Board deleted" }); setActiveBoard(null); resetBoard(); qc.invalidateQueries({ queryKey: ["/api/tactic-boards", teamId] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetBoard() { setPositions(DEFAULT_POSITIONS); setAnnotations([]); setBoardTitle(""); setActiveBoard(null); }

  function loadBoard(board: any) {
    setActiveBoard(board); setBoardTitle(board.title || "");
    let json = board.boardJson || {};
    if (typeof json === "string") { try { json = JSON.parse(json); } catch { json = {}; } }
    setPositions(json.positions || DEFAULT_POSITIONS);
    setAnnotations(json.annotations || []);
  }

  function getSvgCoords(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * COURT_W, y: ((e.clientY - rect.top) / rect.height) * COURT_H };
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) { if (dragging !== null || !drawing) return; setDrawStart(getSvgCoords(e)); }
  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (dragging !== null) { setDragging(null); return; }
    if (drawing && drawStart) {
      const c = getSvgCoords(e); const dx = c.x - drawStart.x; const dy = c.y - drawStart.y;
      if (Math.sqrt(dx*dx+dy*dy) > 15) setAnnotations(prev => [...prev, { x1: drawStart!.x, y1: drawStart!.y, x2: c.x, y2: c.y }]);
      setDrawStart(null);
    }
  }
  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (dragging !== null) {
      const c = getSvgCoords(e);
      setPositions(prev => prev.map((p, i) => i === dragging ? { ...p, x: Math.max(PLAYER_R, Math.min(COURT_W-PLAYER_R, c.x)), y: Math.max(PLAYER_R, Math.min(COURT_H-PLAYER_R, c.y)) } : p));
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-afrocat-white-5 rounded-xl w-fit border border-afrocat-border">
        <button onClick={() => setBoardMode("live")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${boardMode === "live" ? "bg-afrocat-teal text-white shadow" : "text-afrocat-muted hover:text-afrocat-text"}`}
          data-testid="tab-live-tactics">
          <Layers className="inline h-3.5 w-3.5 mr-1" /> Live Tactics
        </button>
        <button onClick={() => setBoardMode("free")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${boardMode === "free" ? "bg-afrocat-teal text-white shadow" : "text-afrocat-muted hover:text-afrocat-text"}`}
          data-testid="tab-free-board">
          <Move className="inline h-3.5 w-3.5 mr-1" /> Free Board
        </button>
      </div>

      {/* ── LIVE TACTICS MODE ── */}
      {boardMode === "live" && (
        <div className="space-y-4">
          {/* Category selector */}
          <div className="flex flex-wrap gap-2" data-testid="tactic-categories">
            {TACTIC_CATS.map(cat => (
              <button key={cat.id} onClick={() => selectCategory(cat.id)}
                data-testid={`cat-${cat.id}`}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                  activeCatId === cat.id
                    ? `${cat.accentBg} ${cat.color} shadow-lg scale-105`
                    : "bg-afrocat-white-5 text-afrocat-muted border-afrocat-border hover:border-afrocat-teal/40"
                }`}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* Sub-tactic buttons */}
          {activeCat && (
            <div className="flex flex-wrap gap-2 pl-1" data-testid="tactic-subtypes">
              {activeCat.tactics.map(t => (
                <button key={t.id} onClick={() => selectTactic(t)}
                  data-testid={`tactic-${t.id}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    activeTacticId === t.id
                      ? `${activeCat.accentBg} ${activeCat.color} shadow`
                      : "bg-afrocat-white-3 text-afrocat-muted border-afrocat-border hover:text-afrocat-text"
                  }`}>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${activeTacticId === t.id ? "bg-white/20" : "bg-afrocat-white-10"}`}>
                    {t.badge}
                  </span>
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* Court + info */}
          {activeTactic ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Court SVG — fullscreen wrapper */}
              <div
                ref={courtContainerRef}
                className={`lg:col-span-2 rounded-xl overflow-hidden border border-afrocat-border relative group ${isFullscreen ? "bg-[#0d1117] flex flex-col justify-center p-4" : ""}`}
              >
                <LiveCourtSVG players={livePlayers} arrows={liveArrows} />
                {/* Fullscreen button overlay */}
                <button
                  onClick={toggleFullscreen}
                  data-testid="button-fullscreen-court"
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white opacity-70 hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/80 z-10"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                {/* Tactic name in fullscreen */}
                {isFullscreen && (
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-black border ${activeCat!.accentBg} ${activeCat!.color}`}>
                      {activeTactic.badge}
                    </span>
                    <span className="text-white text-sm font-bold">{activeTactic.name}</span>
                  </div>
                )}
              </div>

              {/* Info panel */}
              <div className="space-y-3">
                <div className="afrocat-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${activeCat!.accentBg} ${activeCat!.color}`}>
                      {activeTactic.badge}
                    </span>
                    <h3 className="font-display font-bold text-afrocat-text text-sm">{activeTactic.name}</h3>
                  </div>
                  <p className="text-xs text-afrocat-muted leading-relaxed">{activeTactic.description}</p>
                </div>

                <div className="afrocat-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-3.5 w-3.5 text-afrocat-teal" />
                    <span className="text-xs font-bold text-afrocat-text">Key Points</span>
                  </div>
                  <ul className="space-y-2">
                    {activeTactic.keyPoints.map((kp, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-afrocat-muted">
                        <ChevronRight className="h-3 w-3 text-afrocat-teal shrink-0 mt-0.5" />
                        <span>{kp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Colour legend */}
                <div className="afrocat-card p-3">
                  <p className="text-[10px] font-bold text-afrocat-muted mb-2">PLAYER LEGEND</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { color: SC,   label: "Setter (S)" },
                      { color: OHC,  label: "Outside Hitter" },
                      { color: MBC,  label: "Middle Blocker" },
                      { color: OPC,  label: "Opposite (OP)" },
                      { color: LC,   label: "Libero (L)" },
                      { color: OPPC, label: "Opponent" },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                        <span className="text-[9px] text-afrocat-muted">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => { setActiveTacticId(null); setLivePlayers([]); setLiveArrows([]); }}
                  className="w-full py-2 rounded-lg text-xs text-afrocat-muted hover:text-afrocat-text border border-afrocat-border hover:border-afrocat-teal/30 transition-colors cursor-pointer flex items-center justify-center gap-1"
                  data-testid="button-clear-tactic">
                  <RefreshCw className="h-3 w-3" /> Clear Court
                </button>
              </div>
            </div>
          ) : (
            <div className="afrocat-card p-10 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-afrocat-border">
              {activeCat ? (
                <>
                  <div className={`text-3xl ${activeCat.color}`}>{activeCat.icon}</div>
                  <p className="text-sm font-bold text-afrocat-text">Select a {activeCat.name} formation above</p>
                  <p className="text-xs text-afrocat-muted">Players will auto-position on the court with movement arrows</p>
                </>
              ) : (
                <>
                  <Layers className="h-12 w-12 text-afrocat-muted opacity-30" />
                  <p className="text-sm font-bold text-afrocat-text">Live Volleyball Tactics Board</p>
                  <p className="text-xs text-afrocat-muted max-w-xs">Choose a category above — Rotations, Defence, Blocking, Attack Plays or Serve Receive — then click a formation to see players auto-position on the court</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FREE BOARD MODE ── */}
      {boardMode === "free" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={teamId} onChange={e => setTeamId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-tactic-team">
              <option value="">All Teams</option>
              {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {canEdit && (
              <>
                <button onClick={resetBoard} className="px-3 py-1.5 rounded-lg bg-afrocat-teal text-white text-xs font-bold cursor-pointer" data-testid="button-new-board">
                  <Plus className="inline h-3 w-3 mr-1" /> New Board
                </button>
                <button onClick={() => setDrawing(!drawing)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${drawing ? "bg-afrocat-gold text-white" : "bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border"}`}
                  data-testid="button-toggle-draw">
                  {drawing ? "Drawing ON" : "Draw Arrows"}
                </button>
              </>
            )}
          </div>

          {fetchedBoards.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {fetchedBoards.map((b: any) => (
                <button key={b.id} onClick={() => loadBoard(b)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${activeBoard?.id === b.id ? "bg-afrocat-teal text-white" : "bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border"}`}
                  data-testid={`board-tab-${b.id}`}>
                  {b.title || "Untitled"}
                </button>
              ))}
            </div>
          )}

          <div className="afrocat-card p-4 space-y-3">
            {canEdit && (
              <div className="flex gap-2">
                <input value={boardTitle} onChange={e => setBoardTitle(e.target.value)} placeholder="Board title..."
                  className="flex-1 px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-board-title" />
                <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                  className="px-4 py-2 rounded-lg bg-afrocat-teal text-white text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1" data-testid="button-save-board">
                  <Save className="h-4 w-4" /> Save
                </button>
                {activeBoard?.id && (
                  <button onClick={() => { if (confirm("Delete this board?")) deleteMut.mutate(activeBoard.id); }}
                    className="px-3 py-2 rounded-lg bg-afrocat-red-soft text-afrocat-red text-sm font-bold cursor-pointer" data-testid="button-delete-board">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <div className="border border-afrocat-border rounded-xl overflow-hidden bg-green-900/30">
              <svg ref={svgRef} viewBox={`0 0 ${COURT_W} ${COURT_H}`} className="w-full"
                onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}
                style={{ touchAction: "none" }}>
                <rect x={0} y={0} width={COURT_W} height={COURT_H} fill="#1a3a2a" />
                <line x1={COURT_W/2} y1={0} x2={COURT_W/2} y2={COURT_H} stroke="#4ade80" strokeWidth={2} opacity={0.4} />
                <rect x={10} y={10} width={COURT_W/2-15} height={COURT_H-20} fill="none" stroke="#4ade80" strokeWidth={1.5} opacity={0.5} rx={4} />
                <rect x={COURT_W/2+5} y={10} width={COURT_W/2-15} height={COURT_H-20} fill="none" stroke="#4ade80" strokeWidth={1.5} opacity={0.5} rx={4} />
                <line x1={10} y1={COURT_H*0.25} x2={COURT_W/2-5} y2={COURT_H*0.25} stroke="#4ade80" strokeWidth={1} opacity={0.3} strokeDasharray="6,4" />
                <line x1={COURT_W/2+5} y1={COURT_H*0.25} x2={COURT_W-10} y2={COURT_H*0.25} stroke="#4ade80" strokeWidth={1} opacity={0.3} strokeDasharray="6,4" />
                {annotations.map((a, i) => (
                  <g key={`ann-${i}`}>
                    <defs><marker id={`arrowhead-${i}`} markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#facc15" /></marker></defs>
                    <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#facc15" strokeWidth={2} markerEnd={`url(#arrowhead-${i})`} />
                  </g>
                ))}
                {positions.map((p, i) => (
                  <g key={i} style={{ cursor: canEdit ? "grab" : "default" }}
                    onMouseDown={(e) => { if (canEdit) { e.stopPropagation(); setDragging(i); } }}>
                    <circle cx={p.x} cy={p.y} r={PLAYER_R} fill="#14b8a6" stroke="#fff" strokeWidth={2} opacity={0.9} />
                    <text x={p.x} y={p.y+5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">{p.label}</text>
                  </g>
                ))}
              </svg>
            </div>

            {annotations.length > 0 && canEdit && (
              <button onClick={() => setAnnotations([])} className="text-xs text-afrocat-muted hover:text-afrocat-red cursor-pointer" data-testid="button-clear-arrows">
                Clear all arrows
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoachBlog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canWrite = user?.isSuperAdmin || ["ADMIN", "MANAGER", "COACH"].includes(user?.role || "");

  const [topTab, setTopTab] = useState<"posts" | "tactics">("posts");
  const [view, setView] = useState<"list" | "detail" | "compose">("list");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [form, setForm] = useState({ title: "", body: "", category: "GENERAL", tags: "", pinned: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["/api/coach-blog"],
    queryFn: api.getCoachBlogPosts,
  });

  const { data: postDetail } = useQuery({
    queryKey: ["/api/coach-blog", selectedPostId],
    queryFn: () => api.getCoachBlogPost(selectedPostId!),
    enabled: !!selectedPostId && view === "detail",
  });

  const filteredPosts = filterCategory === "ALL"
    ? posts
    : posts.filter((p: any) => p.category === filterCategory);

  const createMut = useMutation({
    mutationFn: () => {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      if (editingId) {
        return api.updateCoachBlogPost(editingId, { ...form, tags });
      }
      return api.createCoachBlogPost({ ...form, tags });
    },
    onSuccess: () => {
      toast({ title: editingId ? "Post updated" : "Post published" });
      resetForm();
      setView("list");
      qc.invalidateQueries({ queryKey: ["/api/coach-blog"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteCoachBlogPost(id),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      setView("list");
      setSelectedPostId(null);
      qc.invalidateQueries({ queryKey: ["/api/coach-blog"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const commentMut = useMutation({
    mutationFn: () => api.addCoachBlogComment(selectedPostId!, commentText),
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["/api/coach-blog", selectedPostId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCommentMut = useMutation({
    mutationFn: (commentId: string) => api.deleteCoachBlogComment(selectedPostId!, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/coach-blog", selectedPostId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({ title: "", body: "", category: "GENERAL", tags: "", pinned: false });
    setEditingId(null);
  }

  function openPost(id: string) {
    setSelectedPostId(id);
    setView("detail");
  }

  function startEdit(post: any) {
    setForm({
      title: post.title,
      body: post.body,
      category: post.category,
      tags: (post.tags || []).join(", "),
      pinned: post.pinned || false,
    });
    setEditingId(post.id);
    setView("compose");
  }

  function canEditPost(post: any) {
    if (user?.isSuperAdmin) return true;
    if (post.authorId === user?.id) return true;
    if (["ADMIN", "MANAGER"].includes(user?.role || "")) return true;
    return false;
  }

  if (view === "compose") {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { resetForm(); setView("list"); }} className="text-afrocat-muted hover:text-afrocat-text transition-colors">
              <ArrowLeft size={20} />
            </button>
            <BookOpen className="h-7 w-7 text-afrocat-teal" />
            <h1 className="text-2xl font-display font-bold text-afrocat-text">
              {editingId ? "Edit Post" : "Write Post"}
            </h1>
          </div>

          <div className="afrocat-card p-6 space-y-5">
            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Title</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Post title..."
                className="w-full px-4 py-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-lg font-display font-bold placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                data-testid="input-blog-title"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-afrocat-muted mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-blog-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-afrocat-muted mb-1 block">Tags (comma-separated)</label>
                <input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. serve, rotation, defense"
                  className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                  data-testid="input-blog-tags"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Content</label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Share your insights, strategies, and tips with the team..."
                rows={14}
                className="w-full px-4 py-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm leading-relaxed placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal resize-none"
                data-testid="input-blog-body"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-afrocat-muted">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                  className="rounded border-afrocat-border"
                  data-testid="checkbox-blog-pinned"
                />
                <Pin size={14} /> Pin to top
              </label>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { resetForm(); setView("list"); }} className="border-afrocat-border text-afrocat-text">
                  Cancel
                </Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!form.title || !form.body || createMut.isPending}
                  data-testid="button-publish-blog"
                  className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
                >
                  {createMut.isPending ? "Saving..." : editingId ? "Update Post" : "Publish Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (view === "detail" && postDetail) {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <button
            onClick={() => { setView("list"); setSelectedPostId(null); }}
            className="flex items-center gap-2 text-sm text-afrocat-muted hover:text-afrocat-text transition-colors"
            data-testid="button-back-to-list"
          >
            <ArrowLeft size={16} /> Back to Coach's Corner
          </button>

          <article className="afrocat-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {postDetail.pinned && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-afrocat-gold bg-afrocat-gold-soft px-2 py-0.5 rounded-full">
                      <Pin size={10} /> PINNED
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[postDetail.category] || CATEGORY_COLORS.GENERAL}`}>
                    {CATEGORIES.find(c => c.value === postDetail.category)?.label || postDetail.category}
                  </span>
                </div>
                <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-blog-post-title">
                  {postDetail.title}
                </h1>
              </div>
              {canEditPost(postDetail) && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(postDetail)} data-testid="button-edit-post" className="p-2 rounded-lg bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-teal transition-colors">
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this post?")) deleteMut.mutate(postDetail.id); }}
                    data-testid="button-delete-post"
                    className="p-2 rounded-lg bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-red transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-afrocat-muted pb-4 border-b border-afrocat-border">
              <span className="flex items-center gap-1"><User size={12} /> {postDetail.authorName}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(postDetail.publishedAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
              {postDetail.updatedAt && postDetail.updatedAt !== postDetail.publishedAt && (
                <span className="text-afrocat-muted/60">(edited)</span>
              )}
            </div>

            <div className="text-sm text-afrocat-text leading-relaxed whitespace-pre-wrap" data-testid="text-blog-post-body">
              {postDetail.body}
            </div>

            {postDetail.tags && postDetail.tags.length > 0 && (
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Tag size={12} className="text-afrocat-muted" />
                {postDetail.tags.map((tag: string, i: number) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          <div className="afrocat-card p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
              <MessageSquare size={18} className="text-afrocat-teal" />
              Comments ({postDetail.comments?.length || 0})
            </h3>

            {postDetail.comments && postDetail.comments.length > 0 ? (
              <div className="space-y-3">
                {postDetail.comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3 p-3 rounded-xl bg-afrocat-white-3" data-testid={`comment-${c.id}`}>
                    <div className="w-8 h-8 rounded-full bg-afrocat-teal-soft flex items-center justify-center text-xs font-bold text-afrocat-teal shrink-0">
                      {(c.authorName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-afrocat-text">{c.authorName}</span>
                        {c.authorRole && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleBadgeColor(c.authorRole)}`}>
                            {c.authorRole}
                          </span>
                        )}
                        <span className="text-[10px] text-afrocat-muted">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-afrocat-text mt-1">{c.body}</p>
                    </div>
                    {(c.authorId === user?.id || user?.isSuperAdmin || ["ADMIN", "MANAGER"].includes(user?.role || "")) && (
                      <button
                        onClick={() => deleteCommentMut.mutate(c.id)}
                        className="text-afrocat-muted hover:text-afrocat-red transition-colors shrink-0 self-start"
                        data-testid={`button-delete-comment-${c.id}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-afrocat-muted">No comments yet. Be the first to share your thoughts!</p>
            )}

            <div className="flex gap-2 pt-2 border-t border-afrocat-border">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && commentText.trim()) { e.preventDefault(); commentMut.mutate(); } }}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                data-testid="input-blog-comment"
              />
              <Button
                onClick={() => commentMut.mutate()}
                disabled={!commentText.trim() || commentMut.isPending}
                data-testid="button-send-comment"
                className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
                size="sm"
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-afrocat-teal" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-coach-blog-title">
                Coach's Corner
              </h1>
              <p className="text-xs text-afrocat-muted">Insights, strategies, and tips from your coaching staff</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canWrite && topTab === "posts" && (
              <Button
                onClick={() => { resetForm(); setView("compose"); }}
                data-testid="button-new-blog-post"
                className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" /> Write Post
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-b border-afrocat-border pb-2">
          <button onClick={() => setTopTab("posts")}
            className={`px-4 py-2 rounded-t-lg text-sm font-bold cursor-pointer transition-colors ${topTab === "posts" ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:text-afrocat-text"}`}
            data-testid="tab-posts">
            <BookOpen className="inline h-4 w-4 mr-1" /> Blog Posts
          </button>
          <button onClick={() => setTopTab("tactics")}
            className={`px-4 py-2 rounded-t-lg text-sm font-bold cursor-pointer transition-colors ${topTab === "tactics" ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:text-afrocat-text"}`}
            data-testid="tab-tactics">
            <LayoutIcon className="inline h-4 w-4 mr-1" /> Tactic Board
          </button>
        </div>

        {topTab === "tactics" ? (
          <TacticBoardSection />
        ) : (
        <div className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="blog-category-filter">
          <button
            onClick={() => setFilterCategory("ALL")}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
              filterCategory === "ALL" ? "bg-afrocat-teal text-white" : "bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-text border border-afrocat-border"
            }`}
          >
            All Posts
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setFilterCategory(c.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                filterCategory === c.value ? "bg-afrocat-teal text-white" : "bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-text border border-afrocat-border"
              }`}
              data-testid={`filter-${c.value}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" /></div>
        ) : filteredPosts.length === 0 ? (
          <div className="afrocat-card p-12 text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-afrocat-muted opacity-30" />
            <h3 className="text-lg font-display font-bold text-afrocat-text mb-1">No posts yet</h3>
            <p className="text-sm text-afrocat-muted">
              {canWrite ? "Be the first to share an insight with the team!" : "Check back later for coaching insights and strategies."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post: any) => (
              <div
                key={post.id}
                onClick={() => openPost(post.id)}
                className="afrocat-card p-5 cursor-pointer hover:border-afrocat-teal/30 transition-colors group"
                data-testid={`blog-post-${post.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {post.pinned && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-afrocat-gold bg-afrocat-gold-soft px-2 py-0.5 rounded-full">
                          <Pin size={10} /> PINNED
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[post.category] || CATEGORY_COLORS.GENERAL}`}>
                        {CATEGORIES.find(c => c.value === post.category)?.label || post.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-display font-bold text-afrocat-text group-hover:text-afrocat-teal transition-colors" data-testid={`text-post-title-${post.id}`}>
                      {post.title}
                    </h3>
                    <p className="text-sm text-afrocat-muted mt-1 line-clamp-2">{post.body}</p>
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {post.tags.slice(0, 4).map((tag: string, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-afrocat-white-5 text-afrocat-muted">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-afrocat-border text-xs text-afrocat-muted">
                  <span className="flex items-center gap-1"><User size={12} /> {post.authorName}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} /> {timeAgo(post.publishedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        )}
      </div>
    </Layout>
  );
}
