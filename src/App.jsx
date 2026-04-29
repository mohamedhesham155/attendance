import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, updateDoc, doc, getDocs, deleteDoc,
  query, serverTimestamp, getDoc, orderBy, where 
} from 'firebase/firestore';

// دالة لجلب التاريخ الحالي بتوقيت مصر بصيغة YYYY-MM-DD
const getEgyptDate = () => {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
};

// وظيفة تصدير الإكسيل (توفير عمود لنوع الإجازة)
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
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getEgyptDate());
  const [laborId, setLaborId] = useState("");
  const [passInput, setPassInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // فلاتر التقارير
  const [reportRange, setReportRange] = useState({ start: "", end: "" });
  const [adminExportRange, setAdminExportRange] = useState({ start: "", end: "" });
  const [personalLogs, setPersonalLogs] = useState([]);
  const [leaveDates, setLeaveDates] = useState({ start: "", end: "", type: "سنوية" });

  // 1. جلب بيانات العمال (مرة واحدة عند التحميل)
  useEffect(() => {
    const fetchWorkers = async () => {
      const snap = await getDocs(collection(db, "workers"));
      setAllWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchWorkers();
  }, []);

  // 2. جلب سجلات اليوم المختار (تحديث عند تغيير التاريخ أو التبويب)
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

  // 3. جلب الطلبات المعلقة للإدارة (منفصلة لضمان الظهور)
  const fetchPending = async () => {
    setLoading(true);
    const q = query(collection(db, "factory_logs"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => {
    if(activeTab === 'admin_panel') fetchPending();
  }, [activeTab]);

  // 4. تقرير الفترة الشخصي
  const fetchPersonalReport = async () => {
    if(!reportRange.start || !reportRange.end) return alert("يرجى تحديد الفترة");
    setLoading(true);
    const q = query(collection(db, "factory_logs"), where("workerId", "==", currentLabor.id));
    const snap = await getDocs(q);
    const filtered = snap.docs.map(d => d.data())
      .filter(l => l.date >= reportRange.start && l.date <= reportRange.end);
    setPersonalLogs(filtered.sort((a,b) => b.date.localeCompare(a.date)));
    setLoading(false);
  };

  // 5. تصدير إكسيل الفترة للإدارة
  const handleAdminExport = async () => {
    if(!adminExportRange.start || !adminExportRange.end) return alert("اختر الفترة للتصدير");
    setLoading(true);
    const snap = await getDocs(collection(db, "factory_logs"));
    const filtered = snap.docs.map(d => d.data())
      .filter(l => l.date >= adminExportRange.start && l.date <= adminExportRange.end);
    exportToCSV(filtered, `Steel_Report_${adminExportRange.start}_to_${adminExportRange.end}`);
    setLoading(false);
  };

  const getStatus = (workerId) => {
    const log = allData.find(l => l.workerId === workerId);
    if (log?.type === 'attendance') return { label: 'حضور', color: 'bg-green-500/10 text-green-500 border-green-500/20', isPresent: true };
    if (log?.type === 'leave') return { label: log.leaveType, color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', isPresent: false };
    if (new Date(selectedDate) <= new Date(getEgyptDate())) return { label: 'غياب', color: 'bg-red-500/10 text-red-500 border-red-500/20', isPresent: false };
    return { label: 'انتظار', color: 'bg-[#1a1a1a] text-gray-500 border-white/5', isPresent: false };
  };

  const handleLogin = async (type) => {
    const id = type === 'admin' ? passInput : laborId;
    const snap = await getDoc(doc(db, type === 'admin' ? "admins" : "workers", id));
    if (snap.exists()) {
      setUserRole(snap.data().role);
      setCurrentLabor({ id: snap.id, ...snap.data() });
      setActiveTab(type === 'admin' ? 'dashboard' : 'request');
    } else alert("البيانات غير صحيحة");
  };

  if (!userRole) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6" dir="rtl">
        <div className="bg-[#0f0f0f] p-12 rounded-[3rem] border border-white/5 w-full max-w-lg text-center shadow-2xl">
            <div className="mb-10 text-white font-black italic text-5xl tracking-tighter">BeadWire<span className="text-red-600">.</span></div>
            <div className="space-y-5">
                <input type="text" placeholder="ID الموظف" value={laborId} onChange={e=>setLaborId(e.target.value)} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white text-center outline-none focus:border-red-600 font-bold transition-all" />
                <button onClick={()=>handleLogin('worker')} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-600/10">دخول الموظفين</button>
                <div className="flex items-center gap-4 py-6"><div className="h-[1px] bg-white/5 flex-1"></div><span className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">Management</span><div className="h-[1px] bg-white/5 flex-1"></div></div>
                <input type="password" placeholder="Password" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center outline-none focus:border-red-600 transition-all" />
                <button onClick={()=>handleLogin('admin')} className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs hover:bg-gray-200 transition-all uppercase">Admin Login</button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans selection:bg-red-600" dir="rtl">
      {/* Header */}
      <header className="bg-[#0a0a0a]/80 border-b border-white/5 p-5 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="bg-red-600 w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-white shadow-xl shadow-red-600/20">S</div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white">{currentLabor?.name}</h2>
              <p className="text-[10px] text-red-600 font-black uppercase italic tracking-widest">{currentLabor?.dept || 'إدارة المركز'}</p>
            </div>
          </div>
          <button onClick={()=>window.location.reload()} className="bg-white/5 hover:bg-red-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] transition-all border border-white/5 uppercase">Logout</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="flex bg-[#0f0f0f] p-1.5 rounded-2xl border border-white/5 mb-12 w-fit mx-auto sm:mx-0 shadow-2xl">
          {userRole !== 'Technician' && (
            <>
              <button onClick={()=>setActiveTab('dashboard')} className={`px-8 py-3.5 rounded-xl font-black text-[11px] transition-all uppercase ${activeTab==='dashboard'?'bg-red-600 text-white shadow-lg shadow-red-600/20':'text-gray-500 hover:text-white'}`}>الرقابة</button>
              <button onClick={()=>setActiveTab('admin_panel')} className={`px-8 py-3.5 rounded-xl font-black text-[11px] transition-all uppercase ${activeTab==='admin_panel'?'bg-red-600 text-white shadow-lg shadow-red-600/20':'text-gray-500 hover:text-white'}`}>الإدارة</button>
            </>
          )}
          <button onClick={()=>setActiveTab('request')} className={`px-8 py-3.5 rounded-xl font-black text-[11px] transition-all uppercase ${activeTab==='request'?'bg-red-600 text-white shadow-lg shadow-red-600/20':'text-gray-500 hover:text-white'}`}>تسجيل</button>
          <button onClick={()=>setActiveTab('my_history')} className={`px-8 py-3.5 rounded-xl font-black text-[11px] transition-all uppercase ${activeTab==='my_history'?'bg-red-600 text-white shadow-lg shadow-red-600/20':'text-gray-500 hover:text-white'}`}>سجلي</button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-16">
            <div className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_red]"></div>
                    <span className="text-sm font-black text-white italic uppercase tracking-widest">تحليل الحضور لليوم: {selectedDate}</span>
                </div>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="bg-black border border-white/10 p-3 rounded-2xl text-xs font-bold text-red-600 outline-none focus:border-red-600 transition-all cursor-pointer" />
            </div>

            {loading ? (
                <div className="text-center py-32 text-gray-800 font-black italic text-4xl tracking-widest animate-pulse uppercase">Syncing Factory...</div>
            ) : (
                ['برونز', 'سحب', 'إدارة'].map(dept => (
                    <div key={dept} className="space-y-8">
                      <div className="flex items-center gap-4">
                          <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">قسم {dept}</h3>
                          <div className="h-[2px] flex-1 bg-gradient-to-l from-red-600/50 to-transparent"></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {['A', 'B', 'C'].map(shift => {
                          const workers = allWorkers.filter(w => (w.dept === dept || (!w.dept && dept === 'إدارة')) && w.shift === shift);
                          if (workers.length === 0) return null;
                          const presentCount = workers.filter(w => getStatus(w.id).isPresent).length;
                          
                          return (
                            <div key={shift} className="bg-[#0f0f0f] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl hover:border-red-600/20 transition-all duration-500">
                              <div className="bg-white/[0.02] p-5 flex justify-between items-center border-b border-white/5">
                                <span className="font-black text-[11px] italic text-gray-500 uppercase tracking-[0.2em]">Shift {shift}</span>
                                <div className="bg-red-600/10 text-red-600 border border-red-600/20 px-5 py-1.5 rounded-full text-[11px] font-black italic">
                                   {presentCount} / {workers.length} Present
                                </div>
                              </div>
                              <div className="p-6 space-y-3.5">
                                {workers.map(w => {
                                  const status = getStatus(w.id);
                                  return (
                                    <div key={w.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-all duration-300 ${status.color}`}>
                                      <span className="font-bold text-[12px] text-white truncate max-w-[170px]">{w.name}</span>
                                      <span className="text-[10px] font-black uppercase italic tracking-tighter opacity-80">{status.label}</span>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto py-10">
            {/* Punch Card */}
            <div className="bg-white p-16 rounded-[4.5rem] text-center shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border-b-[25px] border-red-600 transform hover:-translate-y-3 transition-all duration-700">
              <h3 className="text-black text-4xl font-black mb-16 italic uppercase border-b-4 border-gray-100 pb-6 tracking-tighter">Factory Stamp</h3>
              {allData.find(l => l.workerId === currentLabor.id && l.date === getEgyptDate() && l.type === 'attendance') ? (
                <div className="space-y-8 py-6 animate-in zoom-in duration-500">
                  <div className="bg-green-100 text-green-700 p-12 rounded-[3.5rem] font-black text-3xl italic shadow-inner">VERIFIED ✅</div>
                  <button onClick={async () => {
                    const q = query(collection(db, "factory_logs"), where("workerId", "==", currentLabor.id), where("date", "==", getEgyptDate()), where("type", "==", "attendance"));
                    const snap = await getDocs(q);
                    snap.forEach(async (doc) => await deleteDoc(doc.ref));
                    alert("تم مسح السجل اليومي"); window.location.reload();
                  }} className="text-red-600 font-black underline text-sm uppercase tracking-widest hover:text-black transition-all">Cancel Mistakes</button>
                </div>
              ) : (
                <button onClick={async()=>{
                  const today = getEgyptDate();
                  await addDoc(collection(db,"factory_logs"),{ 
                    workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                    type:'attendance', date:today, status:'confirmed', createdAt:serverTimestamp() 
                  });
                  alert("Attendance Logged!"); setActiveTab('dashboard');
                }} className="w-full bg-red-600 text-white py-24 rounded-[3.5rem] font-black text-8xl shadow-2xl shadow-red-600/40 active:scale-95 transition-all italic tracking-tighter hover:bg-red-700">PUNCH</button>
              )}
            </div>

            {/* Leave Control */}
            <div className="bg-[#0f0f0f] p-12 rounded-[4.5rem] border border-white/5 shadow-3xl">
              <h3 className="text-3xl font-black mb-12 italic text-red-600 uppercase border-b-2 border-white/5 pb-6 tracking-widest">Leave Request</h3>
              <div className="space-y-8">
                <div className="space-y-2">
                    <label className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] ml-2">Select Category</label>
                    <select className="w-full p-5 bg-black border border-white/10 rounded-[2rem] text-white font-black text-xl outline-none focus:border-red-600 appearance-none cursor-pointer" value={leaveDates.type} onChange={e=>setLeaveDates({...leaveDates, type:e.target.value})}>
                      <option value="سنوية">إجازة سنوية</option><option value="مرضي">إجازة مرضية</option><option value="عارضة">إجازة عارضة</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] ml-2">Start</label><input type="date" className="w-full p-5 bg-black border border-white/10 rounded-[2rem] text-white font-bold outline-none focus:border-red-600 transition-all" onChange={e=>setLeaveDates({...leaveDates, start:e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] ml-2">End</label><input type="date" className="w-full p-5 bg-black border border-white/10 rounded-[2rem] text-white font-bold outline-none focus:border-red-600 transition-all" onChange={e=>setLeaveDates({...leaveDates, end:e.target.value})} /></div>
                </div>
                <button onClick={async () => {
                   if (!leaveDates.start) return alert("يرجى تحديد التاريخ");
                   let curr = new Date(leaveDates.start); const end = new Date(leaveDates.end || leaveDates.start);
                   while (curr <= end) {
                     await addDoc(collection(db, "factory_logs"), { 
                       workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                       type: 'leave', leaveType: leaveDates.type, date: curr.toISOString().split('T')[0], status: 'pending', createdAt: serverTimestamp() 
                     });
                     curr.setDate(curr.getDate() + 1);
                   }
                   alert("تم إرسال الطلبات بنجاح"); setActiveTab('dashboard');
                }} className="w-full bg-white text-black py-7 rounded-[2.5rem] font-black text-2xl hover:bg-red-600 hover:text-white transition-all shadow-2xl uppercase tracking-tighter">Submit Application</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my_history' && (
          <div className="max-w-4xl mx-auto py-10">
            <div className="bg-[#0f0f0f] p-10 rounded-[3.5rem] border border-white/5 shadow-2xl">
              <h3 className="text-3xl font-black italic text-red-600 mb-10 uppercase border-r-[12px] border-red-600 pr-6 tracking-tighter leading-none">Activity Log</h3>
              <div className="flex flex-col sm:flex-row gap-6 mb-12 items-end">
                <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">Range Start</label><input type="date" className="w-full bg-black border border-white/10 p-5 rounded-[2rem] text-white font-bold outline-none focus:border-red-600" onChange={e=>setReportRange({...reportRange, start:e.target.value})} /></div>
                <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">Range End</label><input type="date" className="w-full bg-black border border-white/10 p-5 rounded-[2rem] text-white font-bold outline-none focus:border-red-600" onChange={e=>setReportRange({...reportRange, end:e.target.value})} /></div>
                <button onClick={fetchPersonalReport} className="bg-red-600 px-14 py-5 rounded-[2rem] font-black text-xs shadow-xl shadow-red-600/10 hover:scale-105 active:scale-95 transition-all">GENERATE</button>
              </div>

              <div className="space-y-4">
                {personalLogs.map((l, i) => (
                  <div key={i} className="flex justify-between items-center p-8 bg-white/[0.02] rounded-[2.5rem] border border-white/5 hover:bg-white/[0.04] transition-all group">
                    <div><p className="font-black text-2xl text-white tracking-tighter">{l.date}</p><p className="text-[10px] text-red-600 font-bold uppercase mt-1 italic tracking-[0.2em]">Verified Record</p></div>
                    <span className={`px-7 py-2.5 rounded-full font-black text-[11px] uppercase italic ${l.type==='attendance'?'bg-green-500/10 text-green-500 border border-green-500/20':'bg-orange-500/10 text-orange-500 border border-orange-500/20'}`}>
                        {l.type === 'attendance' ? 'Present' : l.leaveType}
                    </span>
                  </div>
                ))}
                {personalLogs.length === 0 && <p className="text-center py-20 text-gray-800 font-black italic uppercase tracking-widest text-sm opacity-50">No logs found in range.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin_panel' && (
          <div className="space-y-12 max-w-6xl mx-auto py-10">
            {/* Range Export UI */}
            <div className="bg-gradient-to-br from-red-600 to-red-900 p-14 rounded-[4rem] shadow-3xl relative overflow-hidden">
              <div className="z-10 relative">
                <h3 className="text-5xl font-black italic uppercase text-white mb-10 tracking-tighter leading-tight">Master Export<br/><span className="text-red-200 opacity-50 text-2xl tracking-[0.1em]">ADMIN TERMINAL</span></h3>
                <div className="flex flex-col lg:flex-row gap-6 items-end">
                  <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Start Date</label><input type="date" className="w-full bg-black/30 border border-white/10 p-5 rounded-[2rem] text-white font-bold outline-none" onChange={e=>setAdminExportRange({...adminExportRange, start:e.target.value})} /></div>
                  <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest">End Date</label><input type="date" className="w-full bg-black/30 border border-white/10 p-5 rounded-[2rem] text-white font-bold outline-none" onChange={e=>setAdminExportRange({...adminExportRange, end:e.target.value})} /></div>
                  <button onClick={handleAdminExport} className="bg-white text-black px-14 py-6 rounded-[2rem] font-black text-xs hover:bg-black hover:text-white transition-all shadow-2xl uppercase tracking-widest">Download Data</button>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 text-[25rem] font-black text-white/5 italic select-none">STEEL</div>
            </div>

            {/* Global Pending List */}
            <div className="bg-[#0f0f0f] p-12 rounded-[4rem] border border-white/5 shadow-3xl">
              <div className="flex justify-between items-center mb-12 border-b-2 border-white/5 pb-6">
                  <h3 className="text-2xl font-black italic text-red-600 uppercase tracking-[0.3em]">Clearance Queue</h3>
                  <button onClick={fetchPending} className="bg-white/5 p-3 rounded-full hover:bg-red-600 transition-all">🔄</button>
              </div>
              <div className="space-y-5">
                {pendingRequests.map(req => (
                  <div key={req.id} className="bg-white/[0.02] p-8 rounded-[3rem] border border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 group hover:bg-white/[0.04] transition-all">
                    <div className="text-center md:text-right">
                        <p className="font-black text-2xl text-white tracking-tight">{req.name}</p>
                        <p className="text-[11px] text-red-600 font-bold italic uppercase mt-2 tracking-widest opacity-80">{req.leaveType} • {req.date}</p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <button onClick={async() => {
                          await updateDoc(doc(db,"factory_logs",req.id), {status:'approved'});
                          setPendingRequests(prev => prev.filter(i => i.id !== req.id));
                          alert("Approved");
                      }} className="flex-1 bg-green-600 px-10 py-4.5 rounded-[1.5rem] font-black text-[11px] uppercase shadow-lg shadow-green-600/10">Approve</button>
                      <button onClick={async() => {
                          await updateDoc(doc(db,"factory_logs",req.id), {status:'rejected'});
                          setPendingRequests(prev => prev.filter(i => i.id !== req.id));
                          alert("Rejected");
                      }} className="flex-1 bg-red-600 px-10 py-4.5 rounded-[1.5rem] font-black text-[11px] uppercase shadow-lg shadow-red-600/10">Reject</button>
                    </div>
                  </div>
                ))}
                {pendingRequests.length === 0 && <p className="text-center py-20 text-gray-800 font-black italic uppercase tracking-widest text-sm opacity-50">No pending clearances.</p>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
