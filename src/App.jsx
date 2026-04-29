import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, updateDoc, doc, getDocs, deleteDoc,
  query, serverTimestamp, getDoc, orderBy, where 
} from 'firebase/firestore';

const getEgyptDate = () => {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
};

// --- تحديث وظيفة الإكسيل لتشمل نوع الإجازة ---
const exportToCSV = (data) => {
  const headers = ["الاسم,القسم,الوردية,النوع,التفاصيل/نوع الإجازة,التاريخ,الحالة"];
  const rows = data.map(l => {
    const details = l.type === 'leave' ? (l.leaveType || 'إجازة') : (l.type === 'attendance' ? 'حضور' : '-');
    return `${l.name || 'مجهول'},${l.dept || 'غير محدد'},${l.shift || 'عام'},${l.type},${details},${l.date},${l.status}`;
  });
  const blob = new Blob(["\uFEFF" + headers.concat(rows).join("\n")], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Elseweddy_Steel_Full_Report.csv`;
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
  
  // لتقرير الفترة الشخصي
  const [reportRange, setReportRange] = useState({ start: "", end: "" });
  const [personalLogs, setPersonalLogs] = useState([]);

  useEffect(() => {
    const fetchWorkers = async () => {
      const snap = await getDocs(collection(db, "workers"));
      setAllWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchWorkers();
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const q = query(collection(db, "factory_logs"), where("date", "==", selectedDate));
      const snap = await getDocs(q);
      setAllData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchLogs();
  }, [selectedDate, activeTab]);

  // جلب تقرير الفترة الشخصي
  const fetchPersonalReport = async () => {
    if(!reportRange.start || !reportRange.end) return alert("اختر الفترة أولاً");
    setLoading(true);
    const q = query(
      collection(db, "factory_logs"), 
      where("workerId", "==", currentLabor.id),
      where("date", ">=", reportRange.start),
      where("date", "<=", reportRange.end)
    );
    const snap = await getDocs(q);
    setPersonalLogs(snap.docs.map(d => d.data()));
    setLoading(false);
  };

  const getStatus = (workerId) => {
    const log = allData.find(l => l.workerId === workerId);
    if (log?.type === 'attendance') return { label: 'حضور', color: 'bg-green-600/20 text-green-500 border-green-600/40' };
    if (log?.type === 'leave') return { label: log.leaveType, color: 'bg-orange-600/20 text-orange-500 border-orange-600/40' };
    if (new Date(selectedDate) <= new Date(getEgyptDate())) return { label: 'غياب', color: 'bg-red-600/20 text-red-500 border-red-600/40' };
    return { label: 'انتظار', color: 'bg-gray-800 text-gray-500 border-gray-700' };
  };

  const handleLogin = async (type) => {
    const id = type === 'admin' ? passInput : laborId;
    const snap = await getDoc(doc(db, type === 'admin' ? "admins" : "workers", id));
    if (snap.exists()) {
      setUserRole(snap.data().role);
      setCurrentLabor({ id: snap.id, ...snap.data() });
      setActiveTab(type === 'admin' ? 'dashboard' : 'request');
    } else alert("خطأ في البيانات");
  };

  if (!userRole) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
        <div className="bg-[#111] p-10 rounded-[2.5rem] border border-white/5 w-full max-w-md text-center">
            <h1 className="text-white text-3xl font-black italic border-b-2 border-red-600 mb-8 inline-block">STEEL</h1>
            <div className="space-y-4">
                <input type="text" placeholder="كود الفني" value={laborId} onChange={e=>setLaborId(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center outline-none focus:border-red-600" />
                <button onClick={()=>handleLogin('worker')} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black">دخول</button>
                <div className="py-2 text-gray-800 font-bold text-[9px] uppercase tracking-widest border-y border-white/5 my-4 italic">Management Only</div>
                <input type="password" placeholder="كلمة السر" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-center outline-none" />
                <button onClick={()=>handleLogin('admin')} className="w-full border border-white/20 text-white py-2.5 rounded-xl font-bold text-xs">دخول الإدارة</button>
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
            <h2 className="text-sm font-black">{currentLabor?.name}</h2>
          </div>
          <button onClick={()=>window.location.reload()} className="bg-white text-black px-4 py-1 rounded-full font-bold text-[10px]">خروج</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Navigation Tabs */}
        <div className="flex bg-[#111] p-1 rounded-xl border border-white/10 mb-8 w-fit mx-auto sm:mx-0">
          {userRole !== 'Technician' && (
            <>
              <button onClick={()=>setActiveTab('dashboard')} className={`px-5 py-2 rounded-lg font-bold text-xs ${activeTab==='dashboard'?'bg-red-600':'text-gray-500'}`}>المتابعة</button>
              <button onClick={()=>setActiveTab('admin_panel')} className={`px-5 py-2 rounded-lg font-bold text-xs ${activeTab==='admin_panel'?'bg-red-600':'text-gray-500'}`}>الإدارة</button>
            </>
          )}
          <button onClick={()=>setActiveTab('request')} className={`px-5 py-2 rounded-lg font-bold text-xs ${activeTab==='request'?'bg-red-600':'text-gray-500'}`}>تسجيل</button>
          <button onClick={()=>setActiveTab('my_history')} className={`px-5 py-2 rounded-lg font-bold text-xs ${activeTab==='my_history'?'bg-red-600':'text-gray-500'}`}>سجلي</button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-[#111] p-4 rounded-2xl border border-white/10 flex justify-between items-center">
              <span className="text-sm font-bold text-red-600 italic">يوم: {selectedDate}</span>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="bg-black border border-white/20 p-1.5 rounded-lg text-xs" />
            </div>
            {['برونز', 'سحب', 'إدارة'].map(dept => (
              <div key={dept} className="space-y-4">
                <h3 className="text-lg font-black italic border-r-4 border-red-600 pr-3">قسم {dept}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {['A', 'B', 'C'].map(shift => {
                    const workers = allWorkers.filter(w => (w.dept === dept || (!w.dept && dept === 'إدارة')) && w.shift === shift);
                    if (workers.length === 0) return null;
                    return (
                      <div key={shift} className="bg-[#111] rounded-[2rem] border border-white/5 overflow-hidden shadow-xl">
                        <div className="bg-white/5 p-3 flex justify-between items-center border-b border-white/5">
                          <span className="font-black text-xs italic">وردية {shift}</span>
                          <span className="bg-red-600 px-2 py-0.5 rounded-full text-[8px] font-black italic">ACTIVE</span>
                        </div>
                        <div className="p-4 space-y-2">
                          {workers.map(w => {
                            const status = getStatus(w.id);
                            return (
                              <div key={w.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${status.color}`}>
                                <span className="font-bold text-[11px] truncate">{w.name}</span>
                                <span className="text-[9px] font-black uppercase italic">{status.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'request' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-10 rounded-[3rem] text-center shadow-2xl border-b-[15px] border-red-600">
              <h3 className="text-black text-2xl font-black mb-6 italic uppercase">Factory Stamp</h3>
              
              {allData.find(l => l.workerId === currentLabor.id && l.date === getEgyptDate() && l.type === 'attendance') ? (
                <div className="space-y-4">
                  <div className="bg-green-100 text-green-700 p-6 rounded-2xl font-black text-xl mb-4">تم تسجيل حضورك اليوم ✅</div>
                  <button onClick={async () => {
                    const q = query(collection(db, "factory_logs"), where("workerId", "==", currentLabor.id), where("date", "==", getEgyptDate()), where("type", "==", "attendance"));
                    const snap = await getDocs(q);
                    snap.forEach(async (doc) => await deleteDoc(doc.ref));
                    alert("تم إلغاء تسجيل اليوم");
                    window.location.reload();
                  }} className="text-red-600 font-bold underline text-sm">إلغاء التسجيل (خطأ)؟</button>
                </div>
              ) : (
                <button onClick={async()=>{
                  const today = getEgyptDate();
                  await addDoc(collection(db,"factory_logs"),{ 
                    workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                    type:'attendance', date:today, status:'confirmed', createdAt:serverTimestamp() 
                  });
                  alert("تم التسجيل 📍"); setActiveTab('dashboard');
                }} className="w-full bg-red-600 text-white py-14 rounded-[2.5rem] font-black text-5xl shadow-xl shadow-red-500/30 active:scale-95 transition-all italic">PUNCH</button>
              )}
            </div>

            <div className="bg-[#111] p-8 rounded-[3rem] border border-white/10 shadow-2xl">
              <h3 className="text-xl font-black mb-6 italic text-red-600 uppercase border-b border-white/5 pb-2">Leave Request</h3>
              <div className="space-y-4">
                <select className="w-full p-4 bg-black border border-white/10 rounded-xl text-white font-black" value={leaveDates.type} onChange={e=>setLeaveDates({...leaveDates, type:e.target.value})}>
                  <option value="سنوية">إجازة سنوية</option><option value="مرضي">إجازة مرضية</option><option value="عارضة">إجازة عارضة</option>
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" className="p-3 bg-black border border-white/10 rounded-xl text-white text-xs" onChange={e=>setLeaveDates({...leaveDates, start:e.target.value})} />
                  <input type="date" className="p-3 bg-black border border-white/10 rounded-xl text-white text-xs" onChange={e=>setLeaveDates({...leaveDates, end:e.target.value})} />
                </div>
                <button onClick={async () => {
                   if (!leaveDates.start) return alert("اختر التاريخ");
                   let curr = new Date(leaveDates.start); const end = new Date(leaveDates.end || leaveDates.start);
                   while (curr <= end) {
                     await addDoc(collection(db, "factory_logs"), { 
                       workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                       type: 'leave', leaveType: leaveDates.type, date: curr.toISOString().split('T')[0], status: 'pending', createdAt: serverTimestamp() 
                     });
                     curr.setDate(curr.getDate() + 1);
                   }
                   alert("تم الإرسال ⏳");
                }} className="w-full bg-white text-black py-4 rounded-xl font-black">إرسال طلب إجازة</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my_history' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-[#111] p-6 rounded-3xl border border-white/10 shadow-xl">
              <h3 className="text-xl font-black italic text-red-600 mb-4 uppercase">Detailed Report</h3>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <input type="date" className="bg-black border border-white/10 p-3 rounded-xl flex-1 text-xs text-white" onChange={e=>setReportRange({...reportRange, start:e.target.value})} />
                <input type="date" className="bg-black border border-white/10 p-3 rounded-xl flex-1 text-xs text-white" onChange={e=>setReportRange({...reportRange, end:e.target.value})} />
                <button onClick={fetchPersonalReport} className="bg-red-600 px-8 py-3 rounded-xl font-black text-xs">عرض التقرير</button>
              </div>

              {personalLogs.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                  <div className="bg-green-600/10 border border-green-600/30 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-green-500">الحضور</p>
                    <p className="text-2xl font-black">{personalLogs.filter(l=>l.type==='attendance').length}</p>
                  </div>
                  <div className="bg-orange-600/10 border border-orange-600/30 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-orange-500">إجازات</p>
                    <p className="text-2xl font-black">{personalLogs.filter(l=>l.type==='leave').length}</p>
                  </div>
                  <div className="bg-red-600/10 border border-red-600/30 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-red-500">المجموع</p>
                    <p className="text-2xl font-black">{personalLogs.length}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {personalLogs.map((l, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 text-xs">
                    <span className="font-bold">{l.date}</span>
                    <span className={`font-black uppercase italic ${l.type==='attendance'?'text-green-500':'text-orange-500'}`}>
                        {l.type === 'attendance' ? 'حضور مؤكد' : `إجازة ${l.leaveType}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin_panel' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-red-600 to-red-900 p-8 rounded-[2rem] flex flex-col sm:flex-row justify-between items-center gap-6 shadow-2xl">
              <div><h3 className="text-2xl font-black italic uppercase text-white">Steel Control</h3><p className="text-red-100 font-bold opacity-70 text-[9px]">Admin Dashboard</p></div>
              <button onClick={() => exportToCSV(allData)} className="bg-black text-white px-6 py-3 rounded-xl font-black text-[10px] border border-white/10">تصدير إكسيل يوم {selectedDate}</button>
            </div>
            {/* عرض طلبات الإجازة المعلقة */}
            <div className="bg-[#111] p-6 rounded-[2rem] border border-white/10">
                <h3 className="text-lg font-black mb-6 italic text-red-600 uppercase border-b border-white/5 pb-2">Pending Requests</h3>
                {allData.filter(l => l.type === 'leave' && l.status === 'pending').map(req => (
                  <div key={req.id} className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 mb-3">
                    <div className="text-center sm:text-right"><p className="font-bold text-sm">{req.name}</p><p className="text-[9px] text-red-500 italic uppercase">{req.leaveType} • {req.date}</p></div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'approved'})} className="flex-1 bg-green-600 px-4 py-2 rounded-lg font-black text-[10px]">قبول</button>
                      <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'rejected'})} className="flex-1 bg-red-600 px-4 py-2 rounded-lg font-black text-[10px]">رفض</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
