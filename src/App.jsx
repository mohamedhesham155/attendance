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

// --- وظيفة الإكسيل المحدثة (تدعم الفترات وأنواع الإجازات) ---
const exportToCSV = (data, fileName = "Factory_Report") => {
  const headers = ["الاسم,القسم,الوردية,النوع,التفاصيل,التاريخ,الحالة"];
  const rows = data.map(l => {
    const details = l.type === 'leave' ? (l.leaveType || 'إجازة') : (l.type === 'attendance' ? 'حضور' : '-');
    return `${l.name || 'مجهول'},${l.dept || 'غير محدد'},${l.shift || 'عام'},${l.type},${details},${l.date},${l.status}`;
  });
  const blob = new Blob(["\uFEFF" + headers.concat(rows).join("\n")], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.csv`;
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
  
  // Ranges
  const [reportRange, setReportRange] = useState({ start: "", end: "" });
  const [adminExportRange, setAdminExportRange] = useState({ start: "", end: "" });
  const [personalLogs, setPersonalLogs] = useState([]);
  const [leaveDates, setLeaveDates] = useState({ start: "", end: "", type: "سنوية" });

  // 1. تحميل قائمة العمال (مرة واحدة عند الدخول فقط)
  useEffect(() => {
    const fetchWorkers = async () => {
      const snap = await getDocs(collection(db, "workers"));
      setAllWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchWorkers();
  }, []);

  // 2. تحميل اللوجات (فقط عند تغيير التاريخ أو التبويب - توفيراً للقراءة)
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

  // 3. تقرير الفترة الشخصي (فلترة داخل الكود لتوفير الـ Index)
  const fetchPersonalReport = async () => {
    if(!reportRange.start || !reportRange.end) return alert("اختر الفترة");
    setLoading(true);
    const q = query(collection(db, "factory_logs"), where("workerId", "==", currentLabor.id));
    const snap = await getDocs(q);
    const filtered = snap.docs.map(d => d.data())
      .filter(l => l.date >= reportRange.start && l.date <= reportRange.end);
    setPersonalLogs(filtered.sort((a,b) => b.date.localeCompare(a.date)));
    setLoading(false);
  };

  // 4. تصدير إكسيل الفترة للإدارة
  const handleAdminExport = async () => {
    if(!adminExportRange.start || !adminExportRange.end) return alert("اختر فترة التصدير");
    setLoading(true);
    // نسحب البيانات المهمة فقط (يمكن تحسينها بفلترة التاريخ لو الداتا ضخمة جداً)
    const snap = await getDocs(collection(db, "factory_logs"));
    const filtered = snap.docs.map(d => d.data())
      .filter(l => l.date >= adminExportRange.start && l.date <= adminExportRange.end);
    exportToCSV(filtered, `Range_Report_${adminExportRange.start}_to_${adminExportRange.end}`);
    setLoading(false);
  };

  const getStatus = (workerId) => {
    const log = allData.find(l => l.workerId === workerId);
    if (log?.type === 'attendance') return { label: 'حضور', color: 'bg-green-600/20 text-green-500 border-green-600/40', isPresent: true };
    if (log?.type === 'leave') return { label: log.leaveType, color: 'bg-orange-600/20 text-orange-500 border-orange-600/40', isPresent: false };
    if (new Date(selectedDate) <= new Date(getEgyptDate())) return { label: 'غياب', color: 'bg-red-600/20 text-red-500 border-red-600/40', isPresent: false };
    return { label: 'انتظار', color: 'bg-gray-800 text-gray-500 border-gray-700', isPresent: false };
  };

  const handleLogin = async (type) => {
    const id = type === 'admin' ? passInput : laborId;
    const snap = await getDoc(doc(db, type === 'admin' ? "admins" : "workers", id));
    if (snap.exists()) {
      setUserRole(snap.data().role);
      setCurrentLabor({ id: snap.id, ...snap.data() });
      setActiveTab(type === 'admin' ? 'dashboard' : 'request');
    } else alert("بيانات خاطئة");
  };

  if (!userRole) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
        <div className="bg-[#111] p-10 rounded-[2.5rem] border border-white/5 w-full max-w-md text-center shadow-2xl">
            <h1 className="text-white text-4xl font-black italic border-b-4 border-red-600 mb-10 inline-block tracking-tighter">STEEL</h1>
            <div className="space-y-4">
                <input type="text" placeholder="كود الموظف" value={laborId} onChange={e=>setLaborId(e.target.value)} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white text-center outline-none focus:border-red-600 font-bold" />
                <button onClick={()=>handleLogin('worker')} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all">دخول النظام</button>
                <div className="py-4 text-gray-800 font-black text-[10px] uppercase tracking-[0.3em] italic">Management Only</div>
                <input type="password" placeholder="كلمة السر" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-center outline-none" />
                <button onClick={()=>handleLogin('admin')} className="w-full border border-white/20 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-white hover:text-black transition-all">دخول الإدارة</button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-600" dir="rtl">
      <header className="bg-black/90 border-b border-white/10 p-5 sticky top-0 z-50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-red-600 w-10 h-10 rounded-xl flex items-center justify-center font-black italic text-white shadow-lg shadow-red-600/30">S</div>
            <div>
              <h2 className="text-sm font-black tracking-tight">{currentLabor?.name}</h2>
              <p className="text-[9px] text-red-500 font-black uppercase italic tracking-widest">{currentLabor?.dept || 'إدارة'}</p>
            </div>
          </div>
          <button onClick={()=>window.location.reload()} className="bg-white text-black px-5 py-2 rounded-full font-black text-[10px] hover:bg-red-600 hover:text-white transition-colors">LOGOUT</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Navigation */}
        <div className="flex bg-[#111] p-1.5 rounded-2xl border border-white/10 mb-10 w-fit mx-auto sm:mx-0 shadow-xl overflow-x-auto">
          {userRole !== 'Technician' && (
            <>
              <button onClick={()=>setActiveTab('dashboard')} className={`px-7 py-3 rounded-xl font-black text-xs transition-all ${activeTab==='dashboard'?'bg-red-600 shadow-lg shadow-red-600/20':'text-gray-500 hover:text-white'}`}>المتابعة</button>
              <button onClick={()=>setActiveTab('admin_panel')} className={`px-7 py-3 rounded-xl font-black text-xs transition-all ${activeTab==='admin_panel'?'bg-red-600 shadow-lg shadow-red-600/20':'text-gray-500 hover:text-white'}`}>الإدارة</button>
            </>
          )}
          <button onClick={()=>setActiveTab('request')} className={`px-7 py-3 rounded-xl font-black text-xs transition-all ${activeTab==='request'?'bg-red-600 shadow-lg shadow-red-600/20':'text-gray-500 hover:text-white'}`}>تسجيل</button>
          <button onClick={()=>setActiveTab('my_history')} className={`px-7 py-3 rounded-xl font-black text-xs transition-all ${activeTab==='my_history'?'bg-red-600 shadow-lg shadow-red-600/20':'text-gray-500 hover:text-white'}`}>سجلي</button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-[#111] p-5 rounded-3xl border border-white/10 flex justify-between items-center shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                    <span className="text-sm font-black text-white italic uppercase tracking-tighter">سجل الإنتاج: {selectedDate}</span>
                </div>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="bg-black border border-white/20 p-2.5 rounded-xl text-xs font-bold text-red-500 outline-none focus:border-red-600 transition-all" />
            </div>

            {loading ? (
                <div className="text-center py-24 text-gray-800 font-black italic text-2xl tracking-[0.2em] animate-pulse">OPTIMIZING DATA...</div>
            ) : (
                ['برونز', 'سحب', 'إدارة'].map(dept => (
                    <div key={dept} className="space-y-6">
                      <h3 className="text-2xl font-black italic border-r-8 border-red-600 pr-4 uppercase tracking-tighter">قسم {dept}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {['A', 'B', 'C'].map(shift => {
                          const workers = allWorkers.filter(w => (w.dept === dept || (!w.dept && dept === 'إدارة')) && w.shift === shift);
                          if (workers.length === 0) return null;
                          const presentCount = workers.filter(w => getStatus(w.id).isPresent).length;
                          
                          return (
                            <div key={shift} className="bg-[#111] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl group hover:border-red-600/30 transition-all duration-500">
                              <div className="bg-white/5 p-4 flex justify-between items-center border-b border-white/5">
                                <span className="font-black text-xs italic text-gray-400">وردية {shift}</span>
                                <div className="bg-red-600 text-white px-4 py-1 rounded-full text-[10px] font-black italic shadow-lg shadow-red-600/20">
                                   {presentCount} / {workers.length} حاضر
                                </div>
                              </div>
                              <div className="p-5 space-y-3">
                                {workers.map(w => {
                                  const status = getStatus(w.id);
                                  return (
                                    <div key={w.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-all duration-300 ${status.color}`}>
                                      <span className="font-black text-[12px] truncate max-w-[160px]">{w.name}</span>
                                      <span className="text-[10px] font-black uppercase italic tracking-tighter">{status.label}</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-6xl mx-auto py-6">
            <div className="bg-white p-12 rounded-[4rem] text-center shadow-3xl border-b-[20px] border-red-600 transform hover:-translate-y-2 transition-all">
              <h3 className="text-black text-3xl font-black mb-12 italic uppercase border-b-4 border-gray-100 pb-4 tracking-tighter">Security Checkpoint</h3>
              {allData.find(l => l.workerId === currentLabor.id && l.date === getEgyptDate() && l.type === 'attendance') ? (
                <div className="space-y-6 py-4">
                  <div className="bg-green-100 text-green-700 p-10 rounded-[2.5rem] font-black text-2xl italic shadow-inner">PUNCHED ✅</div>
                  <button onClick={async () => {
                    const q = query(collection(db, "factory_logs"), where("workerId", "==", currentLabor.id), where("date", "==", getEgyptDate()), where("type", "==", "attendance"));
                    const snap = await getDocs(q);
                    snap.forEach(async (doc) => await deleteDoc(doc.ref));
                    alert("تم إلغاء تسجيل اليوم"); window.location.reload();
                  }} className="text-red-600 font-black underline text-sm uppercase hover:text-black transition-colors">Mistake? Cancel Stamp</button>
                </div>
              ) : (
                <button onClick={async()=>{
                  const today = getEgyptDate();
                  await addDoc(collection(db,"factory_logs"),{ 
                    workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                    type:'attendance', date:today, status:'confirmed', createdAt:serverTimestamp() 
                  });
                  alert("Verified!"); setActiveTab('dashboard');
                }} className="w-full bg-red-600 text-white py-20 rounded-[3rem] font-black text-7xl shadow-2xl shadow-red-500/40 active:scale-95 transition-all italic tracking-tighter">PUNCH</button>
              )}
            </div>

            <div className="bg-[#111] p-10 rounded-[4rem] border border-white/10 shadow-3xl">
              <h3 className="text-2xl font-black mb-10 italic text-red-600 uppercase border-b-2 border-white/5 pb-4 tracking-widest">Leave Control</h3>
              <div className="space-y-6">
                <select className="w-full p-5 bg-black border border-white/10 rounded-2xl text-white font-black text-xl outline-none focus:border-red-600 appearance-none" value={leaveDates.type} onChange={e=>setLeaveDates({...leaveDates, type:e.target.value})}>
                  <option value="سنوية">إجازة سنوية</option><option value="مرضي">إجازة مرضية</option><option value="عارضة">إجازة عارضة</option>
                </select>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2"><label className="text-[10px] text-gray-500 font-black uppercase mr-2">From</label><input type="date" className="w-full p-4 bg-black border border-white/10 rounded-2xl text-white font-bold" onChange={e=>setLeaveDates({...leaveDates, start:e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] text-gray-500 font-black uppercase mr-2">To</label><input type="date" className="w-full p-4 bg-black border border-white/10 rounded-2xl text-white font-bold" onChange={e=>setLeaveDates({...leaveDates, end:e.target.value})} /></div>
                </div>
                <button onClick={async () => {
                   if (!leaveDates.start) return alert("Select Date");
                   let curr = new Date(leaveDates.start); const end = new Date(leaveDates.end || leaveDates.start);
                   while (curr <= end) {
                     await addDoc(collection(db, "factory_logs"), { 
                       workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                       type: 'leave', leaveType: leaveDates.type, date: curr.toISOString().split('T')[0], status: 'pending', createdAt: serverTimestamp() 
                     });
                     curr.setDate(curr.getDate() + 1);
                   }
                   alert("Request Sent"); setActiveTab('dashboard');
                }} className="w-full bg-white text-black py-6 rounded-2xl font-black text-2xl hover:bg-red-600 hover:text-white transition-all shadow-2xl">SUBMIT LEAVE</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my_history' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="bg-[#111] p-8 rounded-[3rem] border border-white/10 shadow-2xl">
              <h3 className="text-2xl font-black italic text-red-600 mb-8 uppercase border-r-8 border-red-600 pr-5">Personal Activity Log</h3>
              <div className="flex flex-col sm:flex-row gap-5 mb-10 items-end">
                <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Start Point</label><input type="date" className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white font-bold" onChange={e=>setReportRange({...reportRange, start:e.target.value})} /></div>
                <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">End Point</label><input type="date" className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white font-bold" onChange={e=>setReportRange({...reportRange, end:e.target.value})} /></div>
                <button onClick={fetchPersonalReport} className="bg-red-600 px-12 py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-600/20 hover:scale-105 active:scale-95 transition-all">GENERATE</button>
              </div>

              <div className="space-y-3">
                {personalLogs.map((l, i) => (
                  <div key={i} className="flex justify-between items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
                    <div><p className="font-black text-xl tracking-tighter">{l.date}</p><p className="text-[10px] text-red-500 font-bold uppercase mt-1 italic tracking-widest">Logged Verification</p></div>
                    <span className={`px-6 py-2 rounded-full font-black text-[10px] uppercase italic ${l.type==='attendance'?'bg-green-600/20 text-green-500 border border-green-600/30':'bg-orange-600/20 text-orange-500 border border-orange-600/30'}`}>
                        {l.type === 'attendance' ? 'Present' : l.leaveType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin_panel' && (
          <div className="space-y-10 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-red-600 via-red-700 to-red-900 p-12 rounded-[4rem] shadow-3xl relative overflow-hidden">
              <div className="z-10 relative">
                <h3 className="text-4xl font-black italic uppercase text-white mb-8 tracking-tighter">Bulk Export Center</h3>
                <div className="flex flex-col lg:flex-row gap-5 items-end">
                  <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-white/50 uppercase">Start Date</label><input type="date" className="w-full bg-black/40 border border-white/20 p-4 rounded-2xl text-white font-bold outline-none" onChange={e=>setAdminExportRange({...adminExportRange, start:e.target.value})} /></div>
                  <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-white/50 uppercase">End Date</label><input type="date" className="w-full bg-black/40 border border-white/20 p-4 rounded-2xl text-white font-bold outline-none" onChange={e=>setAdminExportRange({...adminExportRange, end:e.target.value})} /></div>
                  <button onClick={handleAdminExport} className="bg-white text-black px-12 py-4.5 rounded-2xl font-black text-xs hover:bg-black hover:text-white transition-all shadow-2xl w-full lg:w-auto uppercase tracking-widest">Download Data</button>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 text-[20rem] font-black text-white/5 italic select-none">DATA</div>
            </div>

            <div className="bg-[#111] p-10 rounded-[3.5rem] border border-white/10 shadow-2xl">
              <h3 className="text-xl font-black mb-8 italic text-red-600 uppercase border-b-2 border-white/5 pb-4 tracking-[0.2em]">Pending Leaves</h3>
              <div className="space-y-4">
                {allData.filter(l => l.type === 'leave' && l.status === 'pending').map(req => (
                  <div key={req.id} className="bg-white/5 p-6 rounded-3xl border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 group hover:bg-white/10 transition-all">
                    <div className="text-center sm:text-right"><p className="font-black text-xl tracking-tight">{req.name}</p><p className="text-[11px] text-red-500 font-bold italic uppercase mt-1 tracking-widest">{req.leaveType} • {req.date}</p></div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'approved'})} className="flex-1 bg-green-600 px-8 py-3.5 rounded-xl font-black text-[10px] hover:shadow-lg shadow-green-600/20 transition-all">APPROVE</button>
                      <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'rejected'})} className="flex-1 bg-red-600 px-8 py-3.5 rounded-xl font-black text-[10px] hover:shadow-lg shadow-red-600/20 transition-all">REJECT</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
