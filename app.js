(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const form = $('salary-form');
  if (!form) return;

  const fields = [
    'month', 'gross-base', 'regular-hours', 'holiday-hours', 'overtime-hours',
    'paid-leave-days', 'paid-days', 'bonus-gross', 'weekend-hours', 'weekend-rate',
    'medical-days', 'medical-type', 'medical-average-income', 'medical-reference-days',
    'custom-rate', 'personal-deduction', 'non-taxable-benefits', 'salary-advance',
    'medical-cass', 'medical-cas'
  ].map($);

  const currency = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
  const monthFormatter = new Intl.DateTimeFormat('ro-RO', {
    month: 'long', year: 'numeric'
  });
  const todayFormatter = new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const value = (id) => {
    const raw = $(id).value.trim().replace(',', '.');
    const number = Number(raw);
    return Number.isFinite(number) && number > 0 ? number : 0;
  };
  const money = (number) => `${currency.format(Math.round(number || 0))} lei`;
  const negativeMoney = (number) => `− ${money(number)}`;
  const write = (id, text) => { $(id).textContent = text; };
  const dayKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

  // Algoritm pentru Paștele ortodox (calendarul iulian, apoi conversie la cel gregorian).
  function orthodoxEaster(year) {
    const a = year % 4;
    const b = year % 7;
    const c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31) - 1;
    const day = ((d + e + 114) % 31) + 1;
    // Diferența dintre calendare este 13 zile pentru anii utilizați de calculator.
    return new Date(year, month, day + 13);
  }

  function legalHolidays(year) {
    const fixed = [
      [0, 1], [0, 2], [0, 24], [4, 1], [5, 1], [7, 15], [10, 30],
      [11, 1], [11, 25], [11, 26]
    ].map(([month, day]) => new Date(year, month, day));
    const easter = orthodoxEaster(year);
    const movable = [addDays(easter, -2), addDays(easter, 1), addDays(easter, 50)];
    return new Set([...fixed, ...movable].map(dayKey));
  }

  function periodInfo(monthValue) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
    const today = new Date();
    const year = match ? Number(match[1]) : today.getFullYear();
    const month = match ? Number(match[2]) - 1 : today.getMonth();
    const holidays = legalHolidays(year);
    const finalDay = new Date(year, month + 1, 0).getDate();
    let workdays = 0;
    let weekdayHolidays = 0;

    for (let day = 1; day <= finalDay; day += 1) {
      const date = new Date(year, month, day);
      const weekday = date.getDay();
      const workingDay = weekday !== 0 && weekday !== 6;
      if (workingDay && holidays.has(dayKey(date))) weekdayHolidays += 1;
      if (workingDay && !holidays.has(dayKey(date))) workdays += 1;
    }
    return { date: new Date(year, month, 1), workdays, weekdayHolidays, standardHours: workdays * 8 };
  }

  function medicalRate(days) {
    const type = $('medical-type').value;
    if (type === 'custom') return Math.min(100, value('custom-rate'));
    if (type !== 'ordinary') return Number(type) || 0;
    if (days === 0) return 0;
    if (days <= 7) return 55;
    if (days <= 14) return 65;
    return 75;
  }

  function setMonthDetails(info) {
    write('calendar-number', String(info.workdays));
    write('workdays-label', `${info.workdays} zile lucrătoare`);
    write('period-detail', `${info.standardHours} ore standard · fără sărbătorile legale care cad în timpul săptămânii`);
    write('holiday-count', `${info.weekdayHolidays} libere legale`);
    const label = monthFormatter.format(info.date);
    write('summary-month', label);
    write('net-caption', `pentru ${label}`);
  }

  function calculate() {
    const info = periodInfo($('month').value);
    setMonthDetails(info);

    const grossBase = value('gross-base');
    const regularHours = value('regular-hours');
    const hourlyRate = info.standardHours > 0 ? grossBase / info.standardHours : 0;
    const regularGross = regularHours * hourlyRate;
    const paidDaysGross = (value('paid-leave-days') + value('paid-days')) * 8 * hourlyRate;
    const holidayGross = value('holiday-hours') * hourlyRate;
    const overtimeGross = value('overtime-hours') * hourlyRate * 1.75;
    const weekendGross = value('weekend-hours') * hourlyRate * (value('weekend-rate') / 100);
    const bonusGross = value('bonus-gross');

    const medicalDays = value('medical-days');
    const referenceDays = value('medical-reference-days');
    const dailyMedicalBase = referenceDays > 0 ? (value('medical-average-income') * 6) / referenceDays : 0;
    const rate = medicalRate(medicalDays);
    const medicalGross = dailyMedicalBase * medicalDays * rate / 100;
    const employmentGross = regularGross + paidDaysGross + holidayGross + overtimeGross + weekendGross + bonusGross;
    const gross = employmentGross + medicalGross;

    const cas = employmentGross * 0.25 + ($('medical-cas').checked ? medicalGross * 0.25 : 0);
    const cass = employmentGross * 0.10 + ($('medical-cass').checked ? medicalGross * 0.10 : 0);
    const incomeTaxBase = Math.max(0, gross - cas - cass - value('personal-deduction'));
    const incomeTax = incomeTaxBase * 0.10;
    const deductions = cas + cass + incomeTax;
    const netBeforeBenefits = gross - deductions;
    const benefits = value('non-taxable-benefits');
    const advance = value('salary-advance');
    const net = netBeforeBenefits + benefits - advance;

    // Rezumatul de sus și blocurile din lateral.
    write('total-net', money(net));
    write('total-gross', money(gross));
    write('total-deductions', negativeMoney(deductions));
    write('base-net', money(Math.max(0, grossBase * 0.585)));
    write('base-net-detail', grossBase ? `Tarif orar: ${money(hourlyRate)} · ${info.standardHours} ore standard` : 'CAS, CASS și impozit calculate automat');

    write('sum-regular', money(regularGross + paidDaysGross));
    write('sum-holiday', money(holidayGross));
    write('sum-overtime', money(overtimeGross));
    write('sum-weekend', money(weekendGross));
    write('sum-bonus', money(bonusGross));
    write('sum-medical', money(medicalGross));
    write('sum-gross', money(gross));
    write('sum-cas', negativeMoney(cas));
    write('sum-cass', negativeMoney(cass));
    write('sum-tax', negativeMoney(incomeTax));
    write('sum-deductions', negativeMoney(deductions));
    write('sum-net-before-benefits', money(netBeforeBenefits));
    write('sum-benefits', money(benefits));
    write('sum-advance', negativeMoney(advance));
    write('summary-net', money(net));
    write('net-percentage', gross ? `${Math.round((netBeforeBenefits / gross) * 100)}% din brutul calculat` : '0% din brutul calculat');

    write('medical-gross', money(medicalGross));
    write('medical-rate', medicalDays ? `${rate}%` : '—');
    write('medical-daily-base', money(dailyMedicalBase));
  }

  function refreshFromMonth() {
    const info = periodInfo($('month').value);
    const regular = $('regular-hours');
    if (regular.dataset.automatic === 'true' || !regular.value) {
      regular.value = info.standardHours;
      regular.dataset.automatic = 'true';
    }
    calculate();
  }

  const now = new Date();
  $('month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  $('regular-hours').dataset.automatic = 'true';
  refreshFromMonth();
  write('today-label', todayFormatter.format(now));

  fields.forEach((field) => {
    if (!field) return;
    field.addEventListener('input', () => {
      if (field.id === 'regular-hours') field.dataset.automatic = 'false';
      calculate();
    });
    field.addEventListener('change', () => {
      if (field.id === 'month') refreshFromMonth();
      else calculate();
    });
  });

  $('medical-type').addEventListener('change', () => {
    const isCustom = $('medical-type').value === 'custom';
    $('custom-rate-wrap').hidden = !isCustom;
    calculate();
  });

  $('toggle-medical').addEventListener('click', () => {
    const formula = $('medical-formula');
    const isOpen = !formula.hidden;
    formula.hidden = isOpen;
    $('toggle-medical').setAttribute('aria-expanded', String(!isOpen));
    $('toggle-medical').innerHTML = `${isOpen ? 'Arată' : 'Ascunde'} formula <span>${isOpen ? '↓' : '↑'}</span>`;
  });

  $('print-button').addEventListener('click', () => window.print());
})();
