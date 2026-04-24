import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, updateDoc, doc, onSnapshot, 
  query, serverTimestamp, getDoc, orderBy 
} from 'firebase/firestore';

const getEgyptDate = () => {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

export default function App() {
  const [userRole, setUserRole] = useState(null); 
  const [currentLabor, setCurrentLabor] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [allData, setAllData] = useState([]); 
  const [allWorkers, setAllWorkers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getEgyptDate());
  const [passInput, setPassInput] = useState("");
  const [laborId, setLaborId] = useState("");
  const [leaveDates, setLeaveDates] = useState({ start: "", end: "", type: "سنوية" });

  useEffect(() => {
    const unsubWorkers = onSnapshot(collection(db, "workers"), (snap) => setAllWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const q = query(collection(db, "factory_logs"), orderBy("createdAt", "desc"));
    const unsubLogs = onSnapshot(q, (snap) => setAllData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubWorkers(); unsubLogs(); };
  }, []);

  const handleLogin = async (type) => {
    const id = type === 'admin' ? passInput : laborId;
    const coll = type === 'admin' ? "admins" : "workers"; 
    const snap = await getDoc(doc(db, coll, id));
    if (snap.exists()) {
      const userData = snap.data();
      const workerMatch = allWorkers.find(w => w.name === userData.name);
      setUserRole(userData.role);
      setCurrentLabor({ 
        id: snap.id, 
        name: userData.name || "مستخدم",
        dept: userData.dept || workerMatch?.dept || "إدارة", 
        shift: userData.shift || workerMatch?.shift || "عام" 
      });
      setActiveTab(type === 'admin' ? 'dashboard' : 'request');
    } else alert("البيانات غير صحيحة");
  };

  const getStatus = (workerId) => {
    const log = allData.find(l => l.workerId === workerId && l.date === selectedDate);
    if (!log) return { label: 'غائب', color: 'bg-gray-800/40 text-gray-500 border-gray-700' };
    if (log.type === 'attendance') return { label: 'حاضر', color: 'bg-green-900/30 text-green-400 border-green-800' };
    if (log.type === 'leave') return { label: `إجازة`, color: log.status === 'approved' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-yellow-900/30 text-yellow-500 border-yellow-800' };
    return { label: 'غائب', color: 'bg-gray-800/40 text-gray-500 border-gray-700' };
  };

  if (!userRole) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="bg-[#111] p-8 sm:p-12 rounded-[2rem] sm:rounded-[3rem] border border-white/5 w-full max-w-md text-center shadow-2xl">
        <h1 className="text-white text-3xl sm:text-4xl font-black uppercase tracking-tighter">Elseweddy</h1>
        <h1 className="text-white text-4xl sm:text-5xl font-black italic tracking-widest border-t-2 border-red-600 mb-8">STEEL</h1>
        <div className="space-y-4">
          <input type="text" inputMode="numeric" placeholder="كود الفني" value={laborId} onChange={e=>setLaborId(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center text-lg outline-none focus:border-red-600" />
          <button onClick={()=>handleLogin('worker')} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg active:scale-95 transition-all">دخول الموظفين</button>
          <div className="py-2 text-gray-700 font-bold text-[9px] uppercase tracking-widest italic border-y border-white/5 my-4">Access Control</div>
          <input type="password" placeholder="كلمة المرور" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-center outline-none" />
          <button onClick={()=>handleLogin('admin')} className="w-full border border-white/20 text-white py-2.5 rounded-xl font-bold hover:bg-white hover:text-black transition-all text-sm">دخول الإدارة</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-600/30" dir="rtl">
      {/* Header - Fixed & Compact on Mobile */}
      <header className="bg-black/90 border-b border-white/10 p-4 sm:p-6 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-red-600 w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center font-black italic text-sm sm:text-base">E</div>
            <div>
              <h2 className="text-sm sm:text-lg font-black leading-none truncate max-w-[120px] sm:max-w-none">{currentLabor?.name}</h2>
              <p className="text-[9px] sm:text-[10px] text-red-500 font-black uppercase mt-1 italic tracking-wider">{currentLabor?.dept}</p>
            </div>
          </div>
          <button onClick={()=>setUserRole(null)} className="bg-white text-black px-4 py-1.5 sm:px-6 sm:py-2 rounded-full font-bold text-[10px] sm:text-xs hover:bg-red-600 hover:text-white transition-all">خروج</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Navigation - Scrollable on Mobile */}
        <div className="overflow-x-auto no-scrollbar mb-6 sm:mb-10">
          <div className="flex bg-[#111] p-1 rounded-xl border border-white/10 w-max mx-auto sm:mx-0">
            {userRole !== 'Technician' && (
              <>
                <button onClick={()=>setActiveTab('dashboard')} className={`px-5 py-2.5 sm:px-8 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all ${activeTab==='dashboard'?'bg-red-600':'text-gray-500'}`}>المتابعة</button>
                <button onClick={()=>setActiveTab('admin_panel')} className={`px-5 py-2.5 sm:px-8 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all ${activeTab==='admin_panel'?'bg-red-600':'text-gray-500'}`}>الإدارة</button>
              </>
            )}
            <button onClick={()=>setActiveTab('request')} className={`px-5 py-2.5 sm:px-8 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all ${activeTab==='request'?'bg-red-600':'text-gray-500'}`}>تسجيل</button>
            <button onClick={()=>setActiveTab('my_history')} className={`px-5 py-2.5 sm:px-8 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all ${activeTab==='my_history'?'bg-red-600':'text-gray-500'}`}>سجلي</button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-8 sm:y-12">
            <div className="bg-[#111] p-4 sm:p-6 rounded-2xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-lg font-bold text-red-600 italic">سجل يوم: {selectedDate}</span>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="w-full sm:w-auto bg-black border border-white/20 p-2.5 rounded-lg text-white outline-none focus:border-red-600 text-sm" />
            </div>

            {['برونز', 'سحب', 'إدارة'].map(dept => (
              <div key={dept} className="space-y-4">
                <h3 className="text-xl sm:text-3xl font-black italic border-r-4 sm:border-r-8 border-red-600 pr-3 uppercase">قسم {dept}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                  {['A', 'B', 'C'].map(shift => {
                    const workers = allWorkers.filter(w => (w.dept === dept || (!w.dept && dept === 'إدارة')) && w.shift === shift);
                    if (workers.length === 0) return null;
                    const present = workers.filter(w => getStatus(w.id).label === 'حاضر').length;
                    return (
                      <div key={shift} className="bg-[#111] rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/5 overflow-hidden shadow-xl">
                        <div className="bg-white/5 p-4 flex justify-between items-center border-b border-white/5">
                          <span className="font-black text-lg italic">وردية {shift}</span>
                          <span className="bg-red-600 px-3 py-0.5 rounded-full text-[9px] font-black">{present}/{workers.length}</span>
                        </div>
                        <div className="p-4 space-y-2">
                          {workers.map(w => (
                            <div key={w.id} className={`flex justify-between items-center p-3 rounded-xl border ${getStatus(w.id).color}`}>
                              <span className="font-bold text-[11px] sm:text-sm truncate max-w-[150px]">{w.name}</span>
                              <span className="text-[9px] font-black uppercase italic">{getStatus(w.id).label}</span>
                            </div>
                          ))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 max-w-4xl mx-auto">
            <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[4rem] text-center shadow-2xl border-b-[10px] sm:border-b-[20px] border-red-600">
              <h3 className="text-black text-xl sm:text-3xl font-black mb-6 sm:mb-10 italic uppercase border-b-2 border-gray-100 pb-2">Daily Punch</h3>
              <button onClick={async()=>{
                const today = getEgyptDate();
                if(allData.find(l => l.workerId === currentLabor.id && l.date === today && l.type === 'attendance')) return alert("تم تسجيل حضورك مسبقاً اليوم ✅");
                await addDoc(collection(db,"factory_logs"),{ 
                  workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept, shift: currentLabor.shift, 
                  type:'attendance', date:today, status:'confirmed', createdAt:serverTimestamp() 
                });
                alert("تم إثبات الحضور بنجاح 📍");
              }} className="w-full bg-red-600 text-white py-12 sm:py-20 rounded-[2rem] sm:rounded-[3rem] font-black text-5xl sm:text-7xl shadow-xl shadow-red-500/30 active:scale-95 transition-all italic">PUNCH</button>
            </div>

            <div className="bg-[#111] p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[4rem] border border-white/10 shadow-2xl">
              <h3 className="text-lg sm:text-2xl font-black mb-6 italic text-red-600 uppercase border-b border-white/5 pb-2">Leave Request</h3>
              <div className="space-y-4 sm:space-y-6">
                <select className="w-full p-4 bg-black border border-white/10 rounded-xl text-white font-black text-lg outline-none focus:border-red-600" value={leaveDates.type} onChange={e=>setLeaveDates({...leaveDates, type:e.target.value})}>
                  <option value="سنوية">إجازة سنوية</option>
                  <option value="مرضي">إجازة مرضية</option>
                  <option value="عارضة">إجازة عارضة</option>
                </select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-[10px] text-gray-500 pr-2">من:</label><input type="date" className="w-full p-3 bg-black border border-white/10 rounded-xl text-white font-bold text-sm" onChange={e=>setLeaveDates({...leaveDates, start:e.target.value})} /></div>
                  <div className="space-y-1"><label className="text-[10px] text-gray-500 pr-2">إلى:</label><input type="date" className="w-full p-3 bg-black border border-white/10 rounded-xl text-white font-bold text-sm" onChange={e=>setLeaveDates({...leaveDates, end:e.target.value})} /></div>
                </div>
                <button onClick={async () => {
                  if (!leaveDates.start) return alert("اختر التاريخ أولاً");
                  let curr = new Date(leaveDates.start); const end = new Date(leaveDates.end || leaveDates.start);
                  while (curr <= end) {
                    const dStr = curr.toISOString().split('T')[0];
                    if(!allData.find(l => l.workerId === currentLabor.id && l.date === dStr)) {
                      await addDoc(collection(db, "factory_logs"), { 
                        workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept, shift: currentLabor.shift, 
                        type: 'leave', leaveType: leaveDates.type, date: dStr, status: 'pending', createdAt: serverTimestamp() 
                      });
                    }
                    curr.setDate(curr.getDate() + 1);
                  }
                  alert("تم الإرسال ⏳");
                }} className="w-full bg-white text-black py-4 sm:py-6 rounded-xl font-black text-lg hover:bg-red-600 hover:text-white transition-all">Submit Request</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my_history' && (
          <div className="max-w-2xl mx-auto space-y-3">
            <h3 className="text-xl sm:text-3xl font-black italic mb-6 border-r-4 border-red-600 pr-3 uppercase">Activity Log</h3>
            {allData.filter(l => l.workerId === currentLabor?.id).map(l => (
              <div key={l.id} className="bg-[#111] p-4 rounded-xl border border-white/5 flex justify-between items-center">
                <div><p className="font-black text-base sm:text-xl">{l.date}</p><p className="text-red-500 font-bold text-[9px] uppercase tracking-widest mt-0.5 italic">{l.type === 'attendance' ? 'Punch' : l.leaveType}</p></div>
                <div className={`px-4 py-1.5 rounded-full font-black text-[9px] uppercase ${l.status === 'confirmed' || l.status === 'approved' ? 'bg-green-600/20 text-green-500 border border-green-600/30' : 'bg-amber-600/20 text-amber-500 border border-amber-600/30'}`}>
                  {l.status === 'confirmed' || l.status === 'approved' ? 'Verified' : 'Pending'}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'admin_panel' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-red-600 to-red-900 p-6 sm:p-10 rounded-[2rem] flex flex-col sm:flex-row justify-between items-center gap-6 shadow-xl">
              <div className="text-center sm:text-right"><h3 className="text-2xl sm:text-4xl font-black italic uppercase text-white">Admin Tools</h3><p className="text-red-100 font-bold opacity-80 uppercase text-[9px] tracking-widest">Reports & Management</p></div>
              <div className="flex gap-3">
                <button onClick={() => alert("تحميل PDF...")} className="bg-white text-black px-5 py-3 rounded-xl font-black text-[10px] flex items-center gap-2">📊 GANTT</button>
                <button onClick={() => alert("تصدير CSV...")} className="bg-black text-white px-5 py-3 rounded-xl font-black text-[10px] border border-white/10 flex items-center gap-2">📥 EXCEL</button>
              </div>
            </div>

            <div className="bg-[#111] p-6 rounded-[2rem] border border-white/10 shadow-lg">
              <h3 className="text-lg font-black mb-6 italic text-red-600 uppercase border-b border-white/5 pb-2">Pending Leaves</h3>
              <div className="space-y-3">
                {allData.filter(l => l.type === 'leave' && l.status === 'pending').map(req => (
                  <div key={req.id} className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-center sm:text-right"><p className="font-bold">{req.name}</p><p className="text-[10px] text-red-500 font-black italic">{req.leaveType} • {req.date}</p></div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'approved'})} className="flex-1 sm:flex-none bg-green-600 px-4 py-2 rounded-lg font-black text-[10px]">قبول</button>
                      <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'rejected'})} className="flex-1 sm:flex-none bg-red-600 px-4 py-2 rounded-lg font-black text-[10px]">رفض</button>
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