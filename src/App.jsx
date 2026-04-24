import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, updateDoc, doc, onSnapshot, 
  query, serverTimestamp, getDoc, orderBy 
} from 'firebase/firestore';

// دالة توقيت القاهرة لضمان الدقة بعد منتصف الليل
const getEgyptDate = () => {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

const exportToCSV = (data) => {
  const headers = ["الاسم,القسم,الوردية,النوع,التاريخ,الحالة"];
  const rows = data.map(l => `${l.name || 'مجهول'},${l.dept || 'غير محدد'},${l.shift || 'عام'},${l.type},${l.date},${l.status}`);
  const blob = new Blob(["\uFEFF" + headers.concat(rows).join("\n")], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Elseweddy_Steel_Report.csv`;
  link.click();
};

const exportGanttPDF = (workers, logs, year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date(year, month - 1));
  let html = `
    <div dir="rtl" style="font-family: Arial; padding: 20px;">
      <h1 style="text-align: center; color: #cc0000; margin-bottom:0;">ELSEWEDDY STEEL</h1>
      <h3 style="text-align: center;">مخطط الحضور - ${monthName} ${year}</h3>
      <table border="1" style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center; margin-top:20px;">
        <thead style="background: #000; color: #fff;">
          <tr><th style="padding: 8px; width: 150px;">الاسم</th>${Array.from({length: daysInMonth}, (_,i)=> `<th>${i+1}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${workers.map(w => {
            return `<tr>
              <td style="text-align: right; padding: 4px; font-weight: bold; background: #f5f5f5;">${w.name}</td>
              ${Array.from({length: daysInMonth}, (_,i)=> {
                const d = `${year}-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
                const log = logs.find(l => l.workerId === w.id && l.date === d);
                const color = log?.type === 'attendance' ? '#2ecc71' : (log?.type === 'leave' && log?.status === 'approved' ? '#cc0000' : '#fff');
                return `<td style="background:${color};"></td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  const win = window.open('','_blank'); win.document.write(html); win.document.close(); win.print();
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
    if (!log) return { label: 'غائب', color: 'bg-gray-800 text-gray-500 border-gray-700' };
    if (log.type === 'attendance') return { label: 'حاضر', color: 'bg-green-900/30 text-green-500 border-green-800' };
    if (log.type === 'leave') return { label: `إجازة`, color: log.status === 'approved' ? 'bg-red-900/30 text-red-500 border-red-800' : 'bg-yellow-900/30 text-yellow-500 border-yellow-800' };
    return { label: 'غائب', color: 'bg-gray-800 text-gray-500 border-gray-700' };
  };

  if (!userRole) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6" dir="rtl">
      <div className="bg-[#111] p-12 rounded-[3rem] border border-white/5 w-full max-w-md text-center shadow-2xl">
        <h1 className="text-white text-4xl font-black uppercase tracking-tighter">Elseweddy</h1>
        <h1 className="text-white text-5xl font-black italic tracking-widest border-t-2 border-red-600 mb-8">STEEL</h1>
        <div className="space-y-4">
          <input type="text" placeholder="كود الفني" value={laborId} onChange={e=>setLaborId(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center text-xl outline-none focus:border-red-600" />
          <button onClick={()=>handleLogin('worker')} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-xl active:scale-95 transition-all shadow-lg">دخول الموظفين</button>
          <div className="py-4 text-gray-700 font-bold text-[10px] uppercase tracking-widest italic border-y border-white/5 my-4">Staff & Admin Login</div>
          <input type="password" placeholder="كلمة المرور" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white text-center outline-none" />
          <button onClick={()=>handleLogin('admin')} className="w-full border border-white/20 text-white py-3 rounded-xl font-bold hover:bg-white hover:text-black transition-all">دخول الإدارة</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans" dir="rtl">
      <header className="bg-black border-b border-white/10 p-6 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md bg-black/90">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 w-10 h-10 rounded flex items-center justify-center font-black italic">E</div>
          <div>
            <h2 className="text-lg font-black leading-none">{currentLabor?.name}</h2>
            <p className="text-[10px] text-red-500 font-black uppercase mt-1 italic tracking-widest">{currentLabor?.dept} • {currentLabor?.shift}</p>
          </div>
        </div>
        <button onClick={()=>setUserRole(null)} className="bg-white text-black px-6 py-2 rounded-full font-bold text-xs hover:bg-red-600 hover:text-white">خروج</button>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex bg-[#111] p-1.5 rounded-2xl border border-white/10 mb-10 w-fit">
          {userRole !== 'Technician' && (
            <>
              <button onClick={()=>setActiveTab('dashboard')} className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab==='dashboard'?'bg-red-600 shadow-lg':'text-gray-500'}`}>المتابعة</button>
              <button onClick={()=>setActiveTab('admin_panel')} className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab==='admin_panel'?'bg-red-600 shadow-lg':'text-gray-500'}`}>الإدارة</button>
            </>
          )}
          <button onClick={()=>setActiveTab('request')} className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab==='request'?'bg-red-600 shadow-lg':'text-gray-500'}`}>تسجيل جديد</button>
          <button onClick={()=>setActiveTab('my_history')} className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab==='my_history'?'bg-red-600 shadow-lg':'text-gray-500'}`}>سجلي</button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-12">
            <div className="bg-[#111] p-6 rounded-3xl border border-white/10 flex justify-between items-center">
              <span className="text-xl font-bold text-red-600 italic">سجل يوم: {selectedDate}</span>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="bg-black border border-white/20 p-3 rounded-xl text-white outline-none focus:border-red-600" />
            </div>

            {['برونز', 'سحب', 'إدارة'].map(dept => (
              <div key={dept} className="space-y-6">
                <h3 className="text-3xl font-black italic border-r-8 border-red-600 pr-4 uppercase">قسم {dept}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {['A', 'B', 'C'].map(shift => {
                    const workers = allWorkers.filter(w => (w.dept === dept || (!w.dept && dept === 'إدارة')) && w.shift === shift);
                    if (workers.length === 0) return null;
                    const present = workers.filter(w => getStatus(w.id).label === 'حاضر').length;
                    return (
                      <div key={shift} className="bg-[#111] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                        <div className="bg-white/5 p-5 flex justify-between items-center border-b border-white/5">
                          <span className="font-black text-xl italic">وردية {shift}</span>
                          <span className="bg-red-600 px-4 py-1 rounded-full text-[10px] font-black">{present} / {workers.length} حاضر</span>
                        </div>
                        <div className="p-6 space-y-3">
                          {workers.map(w => (
                            <div key={w.id} className={`flex justify-between items-center p-4 rounded-2xl border ${getStatus(w.id).color}`}>
                              <span className="font-bold text-sm">{w.name}</span>
                              <span className="text-[10px] font-black uppercase italic">{getStatus(w.id).label}</span>
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

        {activeTab === 'admin_panel' && (
          <div className="space-y-8 max-w-5xl">
            <div className="bg-gradient-to-r from-red-600 to-red-900 p-10 rounded-[3rem] flex flex-wrap justify-between items-center shadow-2xl">
              <div><h3 className="text-4xl font-black italic mb-2 tracking-tighter uppercase text-white">Steel Reports</h3><p className="text-red-100 font-bold opacity-80 uppercase text-[10px] tracking-widest">Digital Archive & Gantt</p></div>
              <div className="flex gap-4">
                <button onClick={() => exportGanttPDF(allWorkers, allData, new Date().getFullYear(), new Date().getMonth() + 1)} className="bg-white text-black px-8 py-5 rounded-2xl font-black flex flex-col items-center gap-1 hover:scale-105 shadow-2xl transition-all">📊 <span className="text-[10px] italic">Gantt PDF</span></button>
                <button onClick={() => exportToCSV(allData)} className="bg-black text-white px-8 py-5 rounded-2xl font-black flex flex-col items-center gap-1 border border-white/10 hover:bg-gray-900 shadow-2xl transition-all">📥 <span className="text-[10px] italic">Excel CSV</span></button>
              </div>
            </div>

            <div className="bg-[#111] p-8 rounded-[3rem] border border-white/10">
              <h3 className="text-2xl font-black mb-8 italic border-b border-white/5 pb-4 uppercase">Pending Requests</h3>
              {allData.filter(l => l.type === 'leave' && l.status === 'pending').map(req => (
                <div key={req.id} className="bg-white/5 p-6 rounded-2xl border border-white/5 flex justify-between items-center mb-4">
                  <div><p className="text-xl font-bold">{req.name}</p><p className="text-xs text-red-500 font-black uppercase mt-1 italic">{req.leaveType} • {req.date}</p></div>
                  <div className="flex gap-2">
                    <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'approved'})} className="bg-green-600 px-6 py-3 rounded-xl font-black text-sm">Accept</button>
                    <button onClick={async()=>await updateDoc(doc(db,"factory_logs",req.id),{status:'rejected'})} className="bg-red-600 px-6 py-3 rounded-xl font-black text-sm">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'request' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-12 rounded-[4rem] text-center shadow-2xl border-b-[20px] border-red-600">
              <h3 className="text-black text-3xl font-black mb-10 italic uppercase border-b-2 border-gray-100 pb-4">Daily Stamp</h3>
              <button onClick={async()=>{
                const today = getEgyptDate();
                if(allData.find(l => l.workerId === currentLabor.id && l.date === today && l.type === 'attendance')) return alert("تم تسجيل حضورك مسبقاً اليوم ✅");
                await addDoc(collection(db,"factory_logs"),{ 
                  workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept, shift: currentLabor.shift, 
                  type:'attendance', date:today, status:'confirmed', createdAt:serverTimestamp() 
                });
                alert("تم إثبات الحضور بنجاح 📍");
              }} className="w-full bg-red-600 text-white py-24 rounded-[3rem] font-black text-7xl shadow-2xl shadow-red-500/50 hover:scale-[1.02] active:scale-95 transition-all italic">PUNCH</button>
              <p className="text-gray-400 font-bold mt-8 text-[10px] italic tracking-widest uppercase">Elseweddy Steel - Time Management System</p>
            </div>

            <div className="bg-[#111] p-10 rounded-[4rem] border border-white/10 shadow-2xl">
              <h3 className="text-2xl font-black mb-8 italic text-red-600 uppercase border-b border-white/5 pb-4 tracking-widest">Leave Request</h3>
              <div className="space-y-6">
                <select className="w-full p-6 bg-black border border-white/10 rounded-2xl text-white font-black text-xl outline-none focus:border-red-600" value={leaveDates.type} onChange={e=>setLeaveDates({...leaveDates, type:e.target.value})}>
                  <option value="سنوية">إجازة سنوية</option><option value="مرضي">إجازة مرضية</option><option value="عارضة">إجازة عارضة</option><option value="نص يوم">إذن نصف يوم</option>
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <input type="date" className="p-5 bg-black border border-white/10 rounded-2xl text-white font-bold" onChange={e=>setLeaveDates({...leaveDates, start:e.target.value})} />
                  <input type="date" className="p-5 bg-black border border-white/10 rounded-2xl text-white font-bold" onChange={e=>setLeaveDates({...leaveDates, end:e.target.value})} />
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
                  alert("تم إرسال الطلب للمراجعة ⏳");
                }} className="w-full bg-white text-black py-8 rounded-2xl font-black text-2xl hover:bg-red-600 hover:text-white transition-all shadow-2xl">Submit Form</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my_history' && (
          <div className="max-w-3xl space-y-4">
            <h3 className="text-3xl font-black italic mb-8 border-r-4 border-red-600 pr-4 uppercase">Activity Log</h3>
            {allData.filter(l => l.workerId === currentLabor?.id).map(l => (
              <div key={l.id} className="bg-[#111] p-6 rounded-2xl border border-white/5 flex justify-between items-center group hover:bg-white/5 transition-all">
                <div><p className="font-black text-xl tracking-tighter">{l.date}</p><p className="text-red-500 font-bold text-xs uppercase tracking-widest mt-1 italic">{l.type === 'attendance' ? 'Punch Verified' : `Official Leave: ${l.leaveType}`}</p></div>
                <div className={`px-6 py-2 rounded-full font-black text-[10px] uppercase ${l.status === 'confirmed' || l.status === 'approved' ? 'bg-green-600/20 text-green-500 border border-green-600/30' : 'bg-amber-600/20 text-amber-500 border border-amber-600/30'}`}>
                  {l.status === 'confirmed' || l.status === 'approved' ? 'Verified' : 'Reviewing'}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}