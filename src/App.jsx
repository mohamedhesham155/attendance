import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, updateDoc, doc, getDocs, onSnapshot,
  query, serverTimestamp, getDoc, orderBy, where 
} from 'firebase/firestore';

// دالة توقيت القاهرة
const getEgyptDate = () => {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
};

// --- وظائف التصدير (PDF & CSV) ---
const exportToCSV = (data) => {
  const headers = ["الاسم,القسم,الوردية,النوع,التاريخ,الحالة"];
  const rows = data.map(l => `${l.name || 'مجهول'},${l.dept || 'غير محدد'},${l.shift || 'عام'},${l.type},${l.date},${l.status}`);
  const blob = new Blob(["\uFEFF" + headers.concat(rows).join("\n")], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Elseweddy_Steel_Report.csv`;
  link.click();
};

export default function App() {
  const [userRole, setUserRole] = useState(null); 
  const [currentLabor, setCurrentLabor] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [allData, setAllData] = useState([]); 
  const [allWorkers, setAllWorkers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getEgyptDate());
  const [laborId, setLaborId] = useState("");
  const [passInput, setPassInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [leaveDates, setLeaveDates] = useState({ start: "", end: "", type: "سنوية" });

  // 1. تحميل العمال (مرة واحدة)
  useEffect(() => {
    const fetchWorkers = async () => {
      const snap = await getDocs(collection(db, "workers"));
      setAllWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchWorkers();
  }, []);

  // 2. تحميل اللوجات (فلترة بالتاريخ لتوفير الـ Firebase Reads)
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "factory_logs"), 
          where("date", "==", selectedDate)
        );
        const snap = await getDocs(q);
        setAllData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchLogs();
  }, [selectedDate, activeTab]);

  const getStatus = (workerId) => {
    const log = allData.find(l => l.workerId === workerId);
    if (log?.type === 'attendance') {
      return { label: 'حضور', color: 'bg-green-600/20 text-green-500 border-green-600/40' };
    }
    if (log?.type === 'leave') {
      return { label: log.leaveType || 'إجازة', color: 'bg-orange-600/20 text-orange-500 border-orange-600/40' };
    }
    const isPastOrToday = new Date(selectedDate) <= new Date(getEgyptDate());
    if (isPastOrToday) {
      return { label: 'غياب', color: 'bg-red-600/20 text-red-500 border-red-600/40' };
    }
    return { label: 'انتظار', color: 'bg-gray-800 text-gray-500 border-gray-700' };
  };

  const handleLogin = async (type) => {
    const id = type === 'admin' ? passInput : laborId;
    const snap = await getDoc(doc(db, type === 'admin' ? "admins" : "workers", id));
    if (snap.exists()) {
      const userData = snap.data();
      setUserRole(userData.role);
      setCurrentLabor({ id: snap.id, ...userData });
      setActiveTab(type === 'admin' ? 'dashboard' : 'request');
    } else alert("بيانات الدخول خاطئة");
  };

  if (!userRole) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#111] p-10 rounded-[2.5rem] border border-white/5 w-full max-w-md text-center shadow-2xl">
        <h1 className="text-white text-3xl font-black italic border-b-2 border-red-600 mb-8 inline-block">STEEL</h1>
        <div className="space-y-4">
          <input type="text" placeholder="كود الفني" value={laborId} onChange={e=>setLaborId(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center outline-none focus:border-red-600" />
          <button onClick={()=>handleLogin('worker')} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg">دخول الموظفين</button>
          <div className="py-2 text-gray-800 font-bold text-[9px] uppercase tracking-widest italic border-y border-white/5 my-4">Staff Only</div>
          <input type="password" placeholder="كلمة المرور" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-center outline-none" />
          <button onClick={()=>handleLogin('admin')} className="w-full border border-white/20 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-white hover:text-black transition-all">دخول الإدارة</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans" dir="rtl">
      <header className="bg-black/90 border-b border-white/10 p-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 w-8 h-8 rounded flex items-center justify-center font-black italic text-white text-xs">E</div>
            <div>
              <h2 className="text-sm font-black truncate max-w-[150px]">{currentLabor?.name}</h2>
              <p className="text-[9px] text-red-500 font-black uppercase italic">{currentLabor?.dept}</p>
            </div>
          </div>
          <button onClick={()=>window.location.reload()} className="bg-white text-black px-4 py-1.5 rounded-full font-bold text-[10px]">خروج</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Navigation Tabs */}
        <div className="flex bg-[#111] p-1 rounded-xl border border-white/10 mb-8 w-fit mx-auto sm:mx-0 overflow-x-auto">
          {userRole !== 'Technician' && (
            <>
              <button onClick={()=>setActiveTab('dashboard')} className={`px-6 py-2.5 rounded-lg font-bold text-xs transition-all ${activeTab==='dashboard'?'bg-red-600 shadow-lg':'text-gray-500'}`}>المتابعة</button>
              <button onClick={()=>setActiveTab('admin_panel')} className={`px-6 py-2.5 rounded-lg font-bold text-xs transition-all ${activeTab==='admin_panel'?'bg-red-600 shadow-lg':'text-gray-500'}`}>الإدارة</button>
            </>
          )}
          <button onClick={()=>setActiveTab('request')} className={`px-6 py-2.5 rounded-lg font-bold text-xs transition-all ${activeTab==='request'?'bg-red-600 shadow-lg':'text-gray-500'}`}>تسجيل</button>
          <button onClick={()=>setActiveTab('my_history')} className={`px-6 py-2.5 rounded-lg font-bold text-xs transition-all ${activeTab==='my_history'?'bg-red-600 shadow-lg':'text-gray-500'}`}>سجلي</button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="bg-[#111] p-4 rounded-2xl border border-white/10 flex justify-between items-center shadow-lg">
              <span className="text-sm font-bold text-red-600 italic">سجل يوم: {selectedDate}</span>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="bg-black border border-white/20 p-2 rounded-lg text-xs text-white" />
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-600 font-black italic animate-pulse tracking-widest uppercase">Fetching Factory Data...</div>
            ) : (
              ['برونز', 'سحب', 'إدارة'].map(dept => (
                <div key={dept} className="space-y-5">
                  <h3 className="text-xl font-black italic border-r-4 border-red-600 pr-3 uppercase">قسم {dept}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {['A', 'B', 'C'].map(shift => {
                      const workers = allWorkers.filter(w => (w.dept === dept || (!w.dept && dept === 'إدارة')) && w.shift === shift);
                      if (workers.length === 0) return null;
                      return (
                        <div key={shift} className="bg-[#111] rounded-[2rem] border border-white/5 overflow-hidden shadow-xl">
                          <div className="bg-white/5 p-4 flex justify-between items-center border-b border-white/5">
                            <span className="font-black text-sm italic">وردية {shift}</span>
                            <span className="bg-red-600 px-2 py-0.5 rounded-full text-[9px] font-black italic">SYNCED</span>
                          </div>
                          <div className="p-4 space-y-2.5">
                            {workers.map(w => {
                              const status = getStatus(w.id);
                              return (
                                <div key={w.id} className={`flex justify-between items-center p-3.5 rounded-xl border transition-all ${status.color}`}>
                                  <span className="font-bold text-xs truncate max-w-[150px]">{w.name}</span>
                                  <span className="text-[9px] font-black uppercase italic tracking-tighter">{status.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'request' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mt-4">
            {/* Punch Section */}
            <div className="bg-white p-10 rounded-[3.5rem] text-center shadow-2xl border-b-[15px] border-red-600">
              <h3 className="text-black text-2xl font-black mb-8 italic uppercase border-b-2 border-gray-100 pb-2 tracking-tighter">Factory Stamp</h3>
              <button onClick={async()=>{
                const today = getEgyptDate();
                const q = query(collection(db,"factory_logs"), where("workerId","==",currentLabor.id), where("date","==",today), where("type","==","attendance"));
                const check = await getDocs(q);
                if(!check.empty) return alert("تم تسجيل حضورك مسبقاً ✅");
                await addDoc(collection(db,"factory_logs"),{ 
                  workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                  type:'attendance', date:today, status:'confirmed', createdAt:serverTimestamp() 
                });
                alert("تم إثبات الحضور بنجاح 📍");
                setSelectedDate(today); setActiveTab('dashboard');
              }} className="w-full bg-red-600 text-white py-16 rounded-[2.5rem] font-black text-6xl shadow-xl shadow-red-500/30 active:scale-95 transition-all italic">PUNCH</button>
            </div>

            {/* Leave Section */}
            <div className="bg-[#111] p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
              <h3 className="text-xl font-black mb-6 italic text-red-600 uppercase border-b border-white/5 pb-2">Leave Request</h3>
              <div className="space-y-4">
                <select className="w-full p-4 bg-black border border-white/10 rounded-xl text-white font-black text-lg outline-none focus:border-red-600" value={leaveDates.type} onChange={e=>setLeaveDates({...leaveDates, type:e.target.value})}>
                  <option value="سنوية">إجازة سنوية</option>
                  <option value="مرضي">إجازة مرضية</option>
                  <option value="عارضة">إجازة عارضة</option>
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" className="p-3 bg-black border border-white/10 rounded-xl text-white font-bold text-xs" onChange={e=>setLeaveDates({...leaveDates, start:e.target.value})} />
                  <input type="date" className="p-3 bg-black border border-white/10 rounded-xl text-white font-bold text-xs" onChange={e=>setLeaveDates({...leaveDates, end:e.target.value})} />
                </div>
                <button onClick={async () => {
                  if (!leaveDates.start) return alert("اختر التاريخ");
                  let curr = new Date(leaveDates.start); const end = new Date(leaveDates.end || leaveDates.start);
                  while (curr <= end) {
                    const dStr = curr.toISOString().split('T')[0];
                    await addDoc(collection(db, "factory_logs"), { 
                      workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                      type: 'leave', leaveType: leaveDates.type, date: dStr, status: 'pending', createdAt: serverTimestamp() 
                    });
                    curr.setDate(curr.getDate() + 1);
                  }
                  alert("تم إرسال الطلب ⏳");
                }} className="w-full bg-white text-black py-5 rounded-2xl font-black text-xl hover:bg-red-600 hover:text-white transition-all shadow-xl">Submit Request</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my_history' && (
          <div className="max-w-2xl mx-auto space-y-3">
            <h3 className="text-2xl font-black italic mb-6 border-r-4 border-red-600 pr-3 uppercase">Activity Log</h3>
            {allData.filter(l => l.workerId === currentLabor?.id).map(l => (
              <div key={l.id} className="bg-[#111] p-5 rounded-2xl border border-white/5 flex justify-between items-center group hover:bg-white/5 transition-all">
                <div><p className="font-black text-lg">{l.date}</p><p className="text-red-500 font-bold text-[9px] uppercase mt-0.5 italic">{l.type === 'attendance' ? 'Punch Verified' : `Leave: ${l.leaveType}`}</p></div>
                <div className={`px-4 py-1.5 rounded-full font-black text-[9px] uppercase ${l.status === 'confirmed' || l.status === 'approved' ? 'bg-green-600/20 text-green-500 border border-green-600/30' : 'bg-amber-600/20 text-amber-500 border border-amber-600/30'}`}>
                  {l.status === 'confirmed' || l.status === 'approved' ? 'Verified' : 'Reviewing'}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'admin_panel' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-red-600 to-red-900 p-8 rounded-[3rem] flex flex-col sm:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden">
              <div className="z-10"><h3 className="text-3xl font-black italic uppercase text-white">Reports</h3><p className="text-red-100 font-bold opacity-80 uppercase text-[9px] tracking-widest">Management Center</p></div>
              <div className="flex gap-3 z-10">
                <button onClick={() => exportToCSV(allData)} className="bg-black text-white px-6 py-4 rounded-xl font-black text-[10px] border border-white/10 flex items-center gap-2 hover:bg-white hover:text-black transition-all">📥 DOWNLOAD EXCEL</button>
              </div>
              <div className="absolute -right-5 -bottom-5 text-9xl font-black text-white/5 italic">STEEL</div>
            </div>

            <div className="bg-[#111] p-6 rounded-[2.5rem] border border-white/10 shadow-lg">
              <h3 className="text-lg font-black mb-6 italic text-red-600 uppercase border-b border-white/5 pb-2">Pending Leave Approvals</h3>
              <div className="space-y-3">
                {allData.filter(l => l.type === 'leave' && l.status === 'pending').map(req => (
                  <div key={req.id} className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-center sm:text-right"><p className="font-bold text-sm">{req.name}</p><p className="text-[9px] text-red-500 font-black italic uppercase tracking-tighter">{req.leaveType} • {req.date}</p></div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'approved'})} className="flex-1 sm:flex-none bg-green-600 px-5 py-2.5 rounded-lg font-black text-[10px]">APPROVE</button>
                      <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'rejected'})} className="flex-1 sm:flex-none bg-red-600 px-5 py-2.5 rounded-lg font-black text-[10px]">REJECT</button>
                    </div>
                  </div>
                ))}
                {allData.filter(l => l.type === 'leave' && l.status === 'pending').length === 0 && <p className="text-center py-10 text-gray-600 italic text-sm">No requests to show</p>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
