if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./service-worker.js")
    .then(() => console.log("Service Worker registered"))
    .catch((err) => console.log("SW registration failed:", err));
}


// -- Utilities --
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",];
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyKey = (key) => new Date(key).toDateString()

// --- Storage Keys ---
const WEEK_KEY = "weeklySchedule";
const REC_KEY = "att_records"
const SUB_KEY = "subjects";

// --- Load or initialize Data ---
let weekly = JSON.parse(localStorage.getItem(WEEK_KEY) || null) || defaultWeek();
let records = JSON.parse(localStorage.getItem(REC_KEY) || "{}");
let subjects = JSON.parse(localStorage.getItem(SUB_KEY) || "{}");

// --- DOM refs ---
const calendarEl = document.getElementById("calendar");
const monthYear = document.getElementById("monthYear");
const selectedDatePretty = document.getElementById("selectedDatePretty");
const daySchedule = document.getElementById("daySchedule");
const weekEditor = document.getElementById("weekEditor");
const statsEl = document.getElementById("stats")

function defaultWeek() { return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [], } }

// -- Calendar Display --
let viewDate = new Date();
let selectedDateKey = toKey(new Date());


// -- Calendar Rendering --
function renderCalendar() {
    calendarEl.innerHTML = "";
    weekdays.forEach((w) => {
        const d = document.createElement("div");
        d.className = "day-name";
        d.textContent = w.slice(0, 3);
        calendarEl.appendChild(d);
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    monthYear.textContent = `${viewDate.toLocaleString(undefined, { month: "long", })} ${year}`;

    const first = new Date(year, month, 1);
    const startIndex = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    const total = 42;

    for (let i = 0; i < total; i++) {
        const cell = document.createElement("div");
        cell.className = "date-cell";
        let dayNum, cellDate;
        if (i < startIndex) {
            dayNum = prevDays - (startIndex - 1 - i);
            cellDate = new Date(year, month - 1, dayNum);
            cell.classList.add("other-month");
        } else if (i >= startIndex + daysInMonth) {
            dayNum = i - (startIndex + daysInMonth) + 1;
            cellDate = new Date(year, month + 1, dayNum);
            cell.classList.add("other-month");
        } else {
            dayNum = i - startIndex + 1;
            cellDate = new Date(year, month, dayNum);
        }

        const key = toKey(cellDate);
        cell.textContent = cellDate.getDate();

        if (key === toKey(new Date())) cell.classList.add('today');
        if (key === selectedDateKey) cell.classList.add('selected');

        cell.onclick = () => {
            if (cell.classList.contains('other-month')) viewDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), 1);
            selectedDateKey = key; renderCalendar(); renderDay();
        };

        calendarEl.appendChild(cell);
    }
}

// --- Prev / Next month and Today ---
document.getElementById('prevMonth').onclick = () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); renderCalendar(); };
document.getElementById('todayBtn').onclick = () => { viewDate = new Date(); selectedDateKey = toKey(new Date()); renderCalendar(); renderDay(); };

// --- Week Scheduler renderer
function renderWeekEditor() {
    weekEditor.innerHTML = "";
    let c = 0
    weekdays.forEach((day) => {
        if (weekly[day].length == 0) { c++; return; }
        const wrap = document.createElement("div");
        wrap.className = "weekday card";
        const left = document.createElement("div");
        left.style.flex = "1";

        const title = document.createElement("div");
        title.innerHTML = `<strong>${day}</strong> <span class='small'>(${weekly[day].length} classes)</span>`;
        left.appendChild(title);

        const list = document.createElement("div");
        weekly[day].sort((a, b) => {
            if (!a.time && !b.time) return 0;
            if (!a.time) return 1;
            if (!b.time) return -1;
            return a.time.localeCompare(b.time);
        });

        weekly[day].forEach((it, idx) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.gap = "6px";
            row.style.marginTop = "6px";

            const txt = document.createElement("input");
            txt.type = "text";
            txt.value = it.name.toUpperCase() + (it.time ? " | " + it.time : "");
            txt.dataset.idx = idx;
            txt.onchange = (e) => {
                const v = e.target.value.split("|").map((s) => s.trim());
                const oldName = weekly[day][idx].name
                const newName = v[0] ? v[0].toLowerCase() : oldName;
                const oldTime = weekly[day][idx].time;
                const newTime = v[1] || oldTime || "";
                //Update Weekly
                weekly[day][idx].name = newName;
                weekly[day][idx].time = newTime;
                //Update Subjects
                if (newName !== oldName) {
                    if (subjects[oldName]) { subjects[newName] = subjects[oldName]; delete subjects[oldName]; }
                }
                //Update Records
                subjects[newName].dates.forEach((date) => {
                    if (!records[date]) records[date] = [];
                    records[date].forEach(cls => {
                        if (cls.name === oldName && cls.time === oldTime) cls.name = newName; cls.time = newTime;
                    });
                });
                saveSchedule();
                renderWeekEditor();
                renderDay(); renderStats();
            };
            row.appendChild(txt);

            const rm = document.createElement("button");
            rm.textContent = "Remove";
            rm.className = "btn btn-clear";
            rm.onclick = () => {
                delete subjects[weekly[day][idx].name];
                weekly[day].splice(idx, 1);
                saveSchedule();
                renderWeekEditor();
                renderDay(); renderStats();
            };
            row.appendChild(rm);
            list.appendChild(row);

        });
        left.appendChild(list);
        wrap.appendChild(left);
        weekEditor.appendChild(wrap);
    });
    if (c == 7) {
        weekEditor.innerHTML = "No Classes. Add Classes to create Schedule"
    }
}

// --- Render Day Schedule ---
function getDayScheduleForKey(key) { // return list of classes on that day of the week
    const date = new Date(key);
    const wd = weekdays[date.getDay()];
    return (weekly[wd] || []).map((i) => ({ name: i.name, time: i.time }));
}

function renderDay() { // renderes the schedule for the day
    selectedDatePretty.textContent = prettyKey(selectedDateKey);
    const schedule = getDayScheduleForKey(selectedDateKey);
    daySchedule.innerHTML = ""

    if (schedule.length === 0) {
        const d = document.createElement("div");
        d.textContent = "No Clases scheduled";
        daySchedule.appendChild(d)
        //daySchedule.innerHTML = `<div class="small>No classes scheduled for the day</div>`;
    }

    //load any existing marks for that date
    const rec = records[selectedDateKey] || [];

    rec.forEach(r => {
        if (!subjects.hasOwnProperty(r.name)) removeRecordsForDate(selectedDateKey, r);
    });
    schedule.sort((a, b) => a.time.localeCompare(b.time));

    schedule.forEach((c, idx) => {
        const found = rec.find((r) => r.name === c.name && (r.time || "") === (c.time || ""));
        const status = found ? found.status : "unmarked";

        const row = document.createElement("div");
        row.className = "list-row";
        const left = document.createElement("div");
        left.className = "left"
        left.innerHTML = `<div><strong>${c.name.toUpperCase()}</strong><div class="small">${c.time} - 
                ${status === "present" ? "Class Attented" : status === "absent" ? "Class Missed" : ""}</div></div>`;
        row.appendChild(left);

        const right = document.createElement("div");
        right.className = "right"
        const att = document.createElement("button");
        att.textContent = "Attended";
        att.className = `btn btn-att ${status === "present" ? "active" : status === "absent" ? "inactive" : ""}`;
        const miss = document.createElement("button");
        miss.textContent = "Missed";
        miss.className = `btn btn-miss ${status === "absent" ? "active" : status === "present" ? "inactive" : ""}`;
        const clear = document.createElement("button");
        clear.textContent = "Clear";
        clear.className = `btn btn-clear ${status === "present" || status === "absent" ? "inactive" : ""}`;
        if (status === "present") {
            att.classList.add("active")
            miss.classList.remove("active")
        }
        if (status === "absent") {
            miss.classList.add("active")
            att.classList.remove("active")
            miss.style.opacity = 1; att.style.opacity = 0.4;
        }

        att.onclick = () => {
            setRecordsForDate(selectedDateKey, c, "present");
            renderDay();
            renderStats();
        }
        miss.onclick = () => {
            setRecordsForDate(selectedDateKey, c, "absent");
            renderDay();
            renderStats();
        }
        clear.onclick = () => {
            removeRecordsForDate(selectedDateKey, c);
            renderDay();
            renderStats();
        }

        right.appendChild(att);
        right.appendChild(miss);
        right.appendChild(clear);
        row.appendChild(right);
        daySchedule.appendChild(row);
    });
}

function setRecordsForDate(key, classObj, status) {
    records[key] = records[key] || [];
    subjects[classObj.name] = subjects[classObj.name] || { present: 0, total: 0, dates: [] };

    const sbj = subjects[classObj.name];
    const idx = records[key].findIndex((r) => r.name === classObj.name && (r.time || "") === (classObj.time || ""));

    const entry = { name: classObj.name, time: classObj.time || "", status: status, }
    if (idx >= 0) {
        const old = records[key][idx].status;
        const news = status;
        if (old === "present") { sbj.total--; sbj.present--; }
        else if (old === "absent") sbj.total--;
        if (news === "present") { sbj.total++; sbj.present++; }
        else if (news === "absent") sbj.total++;

        records[key][idx] = entry;
    } else {
        records[key].push(entry);
        if (status === "present") { sbj.total++; sbj.present++; }
        else if (status === "absent") sbj.total++;
    };
    if (!sbj.dates.includes(key)) sbj.dates.push(key);
    subjects[classObj.name] = sbj;
    saveSchedule();
}

function removeRecordsForDate(key, classObj) {
    if (!records[key]) return;
    const idx = records[key].findIndex((r) => r.name === classObj.name && (r.time || "") === (classObj.time || ""));
    if (idx >= 0 && subjects.hasOwnProperty(classObj.name)) {
        if (records[key][idx].status === "present") { subjects[classObj.name].present--; subjects[classObj.name].total--; }
        else if (records[key][idx].status === "absent") subjects[classObj.name].total--;
    }
    records[key].splice(idx, 1);
    if (records[key].length === 0) delete records[key];
    saveSchedule();
}

function renderStats() {
    const subMap = {};
    Object.keys(subjects).forEach((sub) => {
        subMap[sub] = subMap[sub] || {
            name: sub.toUpperCase(), time: "", attended: subjects[sub].present, total: subjects[sub].total
        };
    });
    statsEl.innerHTML = "";
    let overallAtt = 0, overallTot = 0;
    Object.values(subMap).forEach((s) => {
        overallAtt += s.attended; overallTot += s.total;
    });

    const overallPrec = overallTot ? ((overallAtt / overallTot) * 100).toFixed(1) : 0;

    const overallDiv = document.createElement("div")
    overallDiv.innerHTML = `<strong>Overall: ${overallPrec}% (${overallAtt}/${overallTot}) </strong>`;
    overallDiv.style.marginBottom = "8px";
    statsEl.appendChild(overallDiv);

    Object.keys(subMap).sort().forEach(k => {
        const s = subMap[k];
        const row = document.createElement("div");
        row.className = "stats-row";
        row.innerHTML = `<div>${s.name} <div class = 'small'>${s.time || ""}</div></div>
            <div><strong>${s.total ? ((s.attended / s.total) * 100).toFixed(1) : 0}</strong>
            <div class="small">(${s.attended}/${s.total})</div>
        </div>`;
        statsEl.appendChild(row);
    });
};


// -- Adding Class popup Attributes --
const addUI = document.getElementById("addClass");
const addDay = document.getElementById("addDay");
const addClassName = document.getElementById("addClassName");
const addClassTime = document.getElementById("addClassTime");
const saveClassBtn = document.getElementById("saveClass");

addDay.innerHTML = '<option value="">--Select Day--</option>' + weekdays.map((d) => `<option value="${d}">${d}</option>`).join("")

function addPopToggle() {
    addUI.classList.toggle("show");

    // Focus the first input/select automatically when opened
    if (addUI.classList.contains("show")) {
        const focusable = addUI.querySelector("select, input, textarea");
        if (focusable) focusable.focus();
    }
}

// --- Press Enter to trigger Save button ---
addUI.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveClassBtn.click();
        }
    });
});

saveClassBtn.onclick = () => {
    const day = addDay.value;
    const name = addClassName.value.trim().toLowerCase();
    const time = addClassTime.value.trim();
    if (!day || !name || !time) return showToast("Please enter both Day of the week and Class Name");

    let exist = weekly[day].some(item => item.name == name && item.time == time);
    if (exist) return showToast("This Subject and Time already Exist");
    weekly[day].push({ name, time });
    subjects[name] = { present: 0, total: 0, dates: [] };
    saveSchedule();
    renderWeekEditor();
    renderDay();
    renderStats();

    addDay.value = "";
    addClassName.value = "";
    addClassTime.value = "";
    addUI.classList.remove("show");
}

//-- Toast fucntion --
function showToast(msg, duration = 5000) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, duration);
}

//-- Saving The data to local storage
function saveSchedule(saveMsg = true) {
    localStorage.setItem(WEEK_KEY, JSON.stringify(weekly));
    localStorage.setItem(REC_KEY, JSON.stringify(records));
    localStorage.setItem(SUB_KEY, JSON.stringify(subjects));
    if (saveMsg) showToast("Weekly Timetable Saved locally");
}

// --- Export Functionaities ---
// ---  Display The Window ---
exportUI = document.getElementById("exportUI");
document.getElementById("expUIBtn").onclick = () => { exportUI.classList.toggle("show") };
document.getElementById("expUIClose").onclick = () => { exportUI.classList.remove("show") };

//--- Export as Json ---
document.getElementById("expjson").onclick = () => {
    const data = {
        exportedAt: new Date().toISOString(),
        weekly: JSON.parse(localStorage.getItem("attendance_weeklySchedule_v1") || localStorage.getItem("weeklySchedule") || "{}"),
        records: JSON.parse(localStorage.getItem("att_records") || '{}'),
        subjects: JSON.parse(localStorage.getItem("subjects") || '{}'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance_backup.json";
    a.click(); z
    URL.revokeObjectURL(url);
    showToast("file Downloaded");
};

document.getElementById("expcsv").onclick = () => {
    // Header: date,subject,time,status
    let lines = ["date,subject,time,status"];
    Object.keys(records).sort().forEach((k) => {
        records[k].forEach((r) => {
            lines.push(`${k},"${r.name.toUpperCase()}","${r.time || ""}",${r.status}`);
        });
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance_export.csv";
    a.click();
    URL.revokeObjectURL(url);
};

function mergeData(data) {
    const impWeekly = data.weekly || {};
    const impRecords = data.records || {};
    const impSubjects = data.subjects || {};

    Object.keys(impWeekly).forEach(day => {
        if (!weekly[day]) weekly[day] = [];
        impWeekly[day].forEach(newClass => {
            const exist = weekly[day].some(es => es.name === newClass.name && es.time === newClass.time);
            if (!exist) weekly[day].push(newClass);
        });
    });

    Object.keys(impSubjects).forEach(sub => {
        if (!subjects[sub]) subjects[sub] = impSubjects[sub];
        else {
            const existing = subjects[sub].dates || [];
            const newDates = impSubjects[sub].dates || [];
            newDates.forEach(d => {
                if (!existing.includes(d)) existing.push(d);
            });
        }
    });

    Object.keys(impRecords).forEach(date => {
        if (!records[date]) records[date] = [];
        impRecords[date].forEach(newRec => {
            const exists = records[date].some(es => es.name === newRec.name && (es.time || "") === (newRec.time || ""));
            if (!exists) {
                setRecordsForDate(date, newRec, newRec.status);
            }
        });
    });

    Object.keys(subjects).forEach(sub => {
        if (subjects[sub].dates) subjects[sub].dates = [...new Set(subjects[sub].dates)].sort();
    });
    saveSchedule();
    renderDay(); renderCalendar(); renderWeekEditor(); renderStats();
    showToast("Imported Data Merged Successfully")
};

function importJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            mergeData(data);
        } catch (err) {
            showToast("Failed to load JSON");
            console.log(err);
        }
    };
    document.getElementsByClassName("popup")["exportUI"].classList.remove("show");
    reader.readAsText(file);
};


// ---initial render ---
renderCalendar(); renderWeekEditor(); renderDay(); renderStats();

// --- Clear all Existing Data
function clearData() {

    const confirmBox = document.createElement("div");
    confirmBox.classList.add("clearClass")

    const modal = document.createElement("div");
    const requiredText = "Clear All Classes Data";
    modal.innerHTML = `
        <h3>⚠️ Confirm Data Reset</h3>
        <p>This will delete <b>all your schedule and records</b>.</p>
        <p>To confirm, type <b>"${requiredText}"</b> with puntuation below:</p>
        <input id="confirmInput" type="text" placeholder="${requiredText}" style="width: 100%; padding: 5px;">
        <div style="margin-top: 10px;">
            <button class='btn btn-clear' id="cancelBtn">Cancel</button>
            <button class='btn btn-save' id="confirmBtn" disabled>Clear Data</button>
        </div>`;
    confirmBox.appendChild(modal);
    document.body.appendChild(confirmBox)

    const inp = modal.querySelector("#confirmInput");
    const cnf = modal.querySelector("#confirmBtn");
    const cal = modal.querySelector("#cancelBtn");
    if (inp) inp.focus();

    inp.oninput = () => { cnf.disabled = inp.value !== requiredText; };

    // ENTER KEY triggers Clear Data when valid
    inp.addEventListener("keydown", e => {
        if (e.key === "Enter" && !cnf.disabled) {
            e.preventDefault();
            cnf.click();
        }
    });

    cal.onclick = () => { confirmBox.remove() }
    cnf.onclick = () => {
        confirmBox.remove();
        weekly = defaultWeek();
        records = {};
        subjects = {};
        saveSchedule();
        setTimeout(() => { window.location.reload(); }, 3000);
    }
}

// --- Close any popup element ---
function closePopup(popup) {
    if (!popup) return;
    popup.classList.remove("show");
    //for Dynamic created objects
    if (popup.classList.contains("clearClass")) {
        setTimeout(() => popup.remove(), 200);
    }
}
// === Global Escape Key Handler ===
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        document.querySelectorAll(".popup.show, .clearClass").forEach(closePopup);
    }
});

//--- auto-save on unload ---
window.addEventListener("beforeunload", () => {
    localStorage.setItem(WEEK_KEY, JSON.stringify(weekly));
    localStorage.setItem(REC_KEY, JSON.stringify(records));
    localStorage.setItem(SUB_KEY, JSON.stringify(subjects));

});
