import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, updateDoc, doc, getDocs, 
  query, serverTimestamp, getDoc, orderBy, where 
} from 'firebase/firestore';

const getEgyptDate = () => {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
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

  // 1. تحميل العمال (مرة واحدة فقط عند البداية)
  useEffect(() => {
    const fetchWorkers = async () => {
      const snap = await getDocs(collection(db, "workers"));
      setAllWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchWorkers();
  }, []);

  // 2. تحميل اللوجات للتاريخ المختار فقط (لتوفير الـ Reads)
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
      } catch (e) { console.error("Firebase Error:", e); }
      setLoading(false);
    };
    fetchLogs();
  }, [selectedDate, activeTab]); // إعادة التحميل عند تغيير التاريخ

  const getStatus = (workerId) => {
    const log = allData.find(l => l.workerId === workerId);
    
    // حالة الحضور (أخضر)
    if (log?.type === 'attendance') {
      return { label: 'حضور', color: 'bg-green-600/20 text-green-500 border-green-600/40' };
    }
    // حالة الإجازة (برتقالي)
    if (log?.type === 'leave') {
      const type = log.leaveType || 'إجازة';
      return { label: type, color: 'bg-orange-600/20 text-orange-500 border-orange-600/40' };
    }
    // حالة الغياب (أحمر) - إذا لم يوجد لوج واليوم المختار ليس في المستقبل
    const isPastOrToday = new Date(selectedDate) <= new Date(getEgyptDate());
    if (isPastOrToday) {
      return { label: 'غياب', color: 'bg-red-600/20 text-red-500 border-red-600/40' };
    }
    return { label: 'انتظار', color: 'bg-gray-800 text-gray-500 border-gray-700' };
  };

  // دالة تسجيل الدخول
  const handleLogin = async (type) => {
    const id = type === 'admin' ? passInput : laborId;
    const coll = type === 'admin' ? "admins" : "workers"; 
    const snap = await getDoc(doc(db, coll, id));
    if (snap.exists()) {
      const userData = snap.data();
      setUserRole(userData.role);
      setCurrentLabor({ id: snap.id, ...userData });
      setActiveTab(type === 'admin' ? 'dashboard' : 'request');
    } else alert("خطأ في البيانات");
  };

  if (!userRole) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#111] p-8 rounded-[2rem] border border-white/5 w-full max-w-md text-center">
        <h1 className="text-white text-3xl font-black italic tracking-widest border-b-2 border-red-600 mb-8 inline-block">STEEL</h1>
        <div className="space-y-4">
          <input type="text" placeholder="كود الموظف" value={laborId} onChange={e=>setLaborId(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center outline-none focus:border-red-600" />
          <button onClick={()=>handleLogin('worker')} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-red-600/20">دخول</button>
          <div className="py-2 text-gray-700 font-bold text-[9px] uppercase tracking-widest">Admin Access</div>
          <input type="password" placeholder="كلمة المرور" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-center outline-none" />
          <button onClick={()=>handleLogin('admin')} className="w-full border border-white/20 text-white py-2.5 rounded-xl font-bold text-sm">دخول الإدارة</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans" dir="rtl">
      <header className="bg-black/90 border-b border-white/10 p-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 w-8 h-8 rounded flex items-center justify-center font-black italic text-white">E</div>
            <h2 className="text-sm font-black truncate max-w-[150px]">{currentLabor?.name}</h2>
          </div>
          <button onClick={()=>window.location.reload()} className="bg-white text-black px-4 py-1.5 rounded-full font-bold text-[10px]">خروج</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Nav Tabs */}
        <div className="flex bg-[#111] p-1 rounded-xl border border-white/10 mb-6 w-fit mx-auto sm:mx-0 overflow-hidden">
          {userRole !== 'Technician' && (
            <>
              <button onClick={()=>setActiveTab('dashboard')} className={`px-6 py-2 rounded-lg font-bold text-xs transition-all ${activeTab==='dashboard'?'bg-red-600 shadow-lg':'text-gray-500'}`}>المتابعة</button>
              <button onClick={()=>setActiveTab('admin_panel')} className={`px-6 py-2 rounded-lg font-bold text-xs transition-all ${activeTab==='admin_panel'?'bg-red-600 shadow-lg':'text-gray-500'}`}>الإدارة</button>
            </>
          )}
          <button onClick={()=>setActiveTab('request')} className={`px-6 py-2 rounded-lg font-bold text-xs transition-all ${activeTab==='request'?'bg-red-600 shadow-lg':'text-gray-500'}`}>تسجيل</button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Date Selector */}
            <div className="bg-[#111] p-4 rounded-2xl border border-white/10 flex justify-between items-center">
              <span className="text-sm font-bold text-red-600 uppercase italic">سجل: {selectedDate}</span>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="bg-black border border-white/20 p-2 rounded-lg text-xs outline-none focus:border-red-600" />
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-500 font-bold animate-pulse italic">جاري تحميل البيانات من السيرفر...</div>
            ) : (
              ['برونز', 'سحب', 'إدارة'].map(dept => (
                <div key={dept} className="space-y-4">
                  <h3 className="text-xl font-black italic border-r-4 border-red-600 pr-3 uppercase">قسم {dept}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {['A', 'B', 'C'].map(shift => {
                      const workers = allWorkers.filter(w => (w.dept === dept || (!w.dept && dept === 'إدارة')) && w.shift === shift);
                      if (workers.length === 0) return null;
                      return (
                        <div key={shift} className="bg-[#111] rounded-[1.5rem] border border-white/5 overflow-hidden">
                          <div className="bg-white/5 p-3 flex justify-between items-center border-b border-white/5">
                            <span className="font-black text-sm italic">وردية {shift}</span>
                            <span className="bg-red-600 px-2 py-0.5 rounded-full text-[9px] font-black italic">SH-ID</span>
                          </div>
                          <div className="p-4 space-y-2">
                            {workers.map(w => {
                              const status = getStatus(w.id);
                              return (
                                <div key={w.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${status.color}`}>
                                  <span className="font-bold text-xs truncate max-w-[140px]">{w.name}</span>
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
              ))
            )}
          </div>
        )}

        {/* ... بقية الـ Tabs (request, admin_panel) مع تعديل الـ addDoc ليستخدم التاريخ بصيغة getEgyptDate() ... */}
        {activeTab === 'request' && (
          <div className="max-w-md mx-auto bg-white p-10 rounded-[3rem] text-center shadow-2xl border-b-[15px] border-red-600 mt-10">
            <h3 className="text-black text-2xl font-black mb-8 italic uppercase border-b-2 border-gray-100 pb-2">Daily Stamp</h3>
            <button onClick={async()=>{
              const today = getEgyptDate();
              // التأكد من عدم التكرار
              const q = query(collection(db,"factory_logs"), where("workerId","==",currentLabor.id), where("date","==",today));
              const check = await getDocs(q);
              if(!check.empty) return alert("مسجل حضور بالفعل ✅");
              
              await addDoc(collection(db,"factory_logs"),{ 
                workerId: currentLabor.id, name: currentLabor.name, dept: currentLabor.dept || "إدارة", shift: currentLabor.shift || "عام", 
                type:'attendance', date:today, status:'confirmed', createdAt:serverTimestamp() 
              });
              alert("تم التسجيل بنجاح 📍");
              setActiveTab('dashboard');
            }} className="w-full bg-red-600 text-white py-16 rounded-[2.5rem] font-black text-6xl shadow-xl active:scale-95 transition-all italic">PUNCH</button>
          </div>
        )}
      </main>
    </div>
  );
}
