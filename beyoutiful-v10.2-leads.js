/* =========================================================
   BEYOUTIFUL V10.2 — LEADS
   New Lead → Waiting → Follow Up → Booked
   ========================================================= */

(function () {
   
function ensureLeads() {
    if (typeof data === 'undefined') return [];
    if (!Array.isArray(data.leads)) data.leads = [];
    return data.leads;
}
  
  }

  function leadId() {
    return 'L' + Date.now();
  }

  function leadDateTime() {
    return new Date().toISOString();
  }

  function leadHoursAgo(value) {
    if (!value) return 0;
    return (Date.now() - new Date(value).getTime()) / 3600000;
  }

  function leadStatus(lead) {
    if (lead.status === 'Booked') return 'Booked';
    if (lead.status === 'Closed') return 'Closed';

    if (leadHoursAgo(lead.lastContact || lead.createdAt) >= 24) {
      return 'Follow Up';
    }

    return lead.status || 'New';
  }

  function leadStatusClass(status) {
    if (status === 'Booked') return 'ok';
    if (status === 'Follow Up') return 'danger';
    return '';
  }

  window.leadCounts = function () {
    const leads = ensureLeads();

    return {
      new: leads.filter(x => leadStatus(x) === 'New').length,
      waiting: leads.filter(x => leadStatus(x) === 'Waiting').length,
      followup: leads.filter(x => leadStatus(x) === 'Follow Up').length,
      booked: leads.filter(x => leadStatus(x) === 'Booked').length
    };
  };

  window.leadsHomeHTML = function () {
    const c = leadCounts();

    return `
      <div class="card section" id="leadsHomeCard">
        <div class="section-head">
          <div>
            <b>LEADS</b>
            <div class="muted">New enquiries & follow-up</div>
          </div>
          <button class="btn" onclick="openLeadManager()">View Leads</button>
        </div>

        <div class="grid stats">
          <div>
            <div class="muted">NEW LEADS</div>
            <div class="stat">${c.new}</div>
          </div>

          <div>
            <div class="muted">WAITING</div>
            <div class="stat">${c.waiting}</div>
          </div>

          <div>
            <div class="muted">FOLLOW UP TODAY</div>
            <div class="stat">${c.followup}</div>
          </div>

          <div>
            <div class="muted">BOOKED</div>
            <div class="stat">${c.booked}</div>
          </div>
        </div>

        <div style="margin-top:14px">
          <button class="btn primary" onclick="openNewLead()">＋ New Lead</button>
        </div>
      </div>
    `;
  };

  window.openLeadManager = function () {
    const leads = ensureLeads()
      .slice()
      .sort((a, b) => {
        const sa = leadStatus(a) === 'Follow Up' ? 0 : 1;
        const sb = leadStatus(b) === 'Follow Up' ? 0 : 1;

        if (sa !== sb) return sa - sb;

        return String(b.createdAt || '').localeCompare(
          String(a.createdAt || '')
        );
      });

    const rows = leads.length
      ? leads.map(l => {
          const status = leadStatus(l);

          return `
            <div class="row" style="align-items:flex-start">
              <div style="min-width:0;flex:1">
                <b>${esc(l.name || 'Unknown')}</b>

                <div class="muted">
                  ${esc(l.source || 'Unknown Source')}
                  ${l.interest ? ' · ' + esc(l.interest) : ''}
                </div>

                ${
                  l.phone
                    ? `<div class="muted">${esc(l.phone)}</div>`
                    : ''
                }

                ${
                  l.remark
                    ? `<div style="margin-top:5px">${esc(l.remark)}</div>`
                    : ''
                }

                <div style="margin-top:7px">
                  <span class="pill ${leadStatusClass(status)}">
                    ${esc(status)}
                  </span>
                </div>
              </div>

              <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
                ${
                  l.phone
                    ? `<button class="btn" onclick="leadWhatsApp('${l.id}')">WhatsApp</button>`
                    : ''
                }

                ${
                  status !== 'Booked'
                    ? `<button class="btn" onclick="markLeadWaiting('${l.id}')">Waiting</button>`
                    : ''
                }

                ${
                  status !== 'Booked'
                    ? `<button class="btn primary" onclick="markLeadBooked('${l.id}')">Booked</button>`
                    : ''
                }

                <button class="btn" onclick="editLead('${l.id}')">Edit</button>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="empty">No leads yet.</div>`;

    openModal(
      'LEADS',
      `
        <div style="margin-bottom:14px">
          <button class="btn primary" onclick="openNewLead()">＋ New Lead</button>
        </div>

        ${rows}
      `
    );
  };

  window.openNewLead = function () {
    openModal(
      'NEW LEAD',
      `
        <div class="form-grid">

          <label>
            Customer Name
            <input id="leadName" placeholder="Name">
          </label>

          <label>
            WhatsApp / Phone
            <input id="leadPhone" placeholder="01xxxxxxxx">
          </label>

          <label>
            Source
            <select id="leadSource">
              <option>Facebook Ads</option>
              <option>Instagram</option>
              <option>Xiaohongshu</option>
              <option>Google</option>
              <option>TikTok</option>
              <option>WhatsApp</option>
              <option>Referral</option>
              <option>Walk-in</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Interested Service
            <select id="leadInterest">
              <option value="">Select Service</option>
              ${
                Array.isArray(data.services)
                  ? data.services
                      .filter(x => x.active !== false)
                      .map(
                        x =>
                          `<option value="${esc(x.name)}">${esc(x.name)}</option>`
                      )
                      .join('')
                  : ''
              }
              <option value="Other">Other</option>
            </select>
          </label>

          <label style="grid-column:1/-1">
            Remark
            <textarea id="leadRemark" rows="3"
              placeholder="例如：问周年配套 / 星期六想来 / 需要考虑"></textarea>
          </label>

        </div>

        <div style="margin-top:16px">
          <button class="btn primary" onclick="saveNewLead()">SAVE LEAD</button>
        </div>
      `
    );
  };

  window.saveNewLead = async function () {
    ensureLeads();

    const name = $('leadName').value.trim();
    const phone = $('leadPhone').value.trim();

    if (!name) {
      alert('Please enter customer name.');
      return;
    }

    const now = leadDateTime();

    data.leads.push({
      id: leadId(),
      name,
      phone,
      source: $('leadSource').value,
      interest: $('leadInterest').value,
      remark: $('leadRemark').value.trim(),
      status: 'New',
      createdAt: now,
      lastContact: now,
      bookedAt: ''
    });

    await save();

    closeModal();
    render();
  };

  window.editLead = function (id) {
    const l = ensureLeads().find(x => x.id === id);
    if (!l) return;

    openModal(
      'EDIT LEAD',
      `
        <div class="form-grid">

          <label>
            Customer Name
            <input id="editLeadName" value="${esc(l.name || '')}">
          </label>

          <label>
            WhatsApp / Phone
            <input id="editLeadPhone" value="${esc(l.phone || '')}">
          </label>

          <label>
            Source
            <input id="editLeadSource" value="${esc(l.source || '')}">
          </label>

          <label>
            Interested Service
            <input id="editLeadInterest" value="${esc(l.interest || '')}">
          </label>

          <label style="grid-column:1/-1">
            Remark
            <textarea id="editLeadRemark" rows="3">${esc(l.remark || '')}</textarea>
          </label>

        </div>

        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn primary" onclick="saveLeadEdit('${l.id}')">
            SAVE
          </button>

          <button class="btn" onclick="closeLead('${l.id}')">
            Close Lead
          </button>
        </div>
      `
    );
  };

  window.saveLeadEdit = async function (id) {
    const l = ensureLeads().find(x => x.id === id);
    if (!l) return;

    l.name = $('editLeadName').value.trim();
    l.phone = $('editLeadPhone').value.trim();
    l.source = $('editLeadSource').value.trim();
    l.interest = $('editLeadInterest').value.trim();
    l.remark = $('editLeadRemark').value.trim();

    await save();

    closeModal();
    render();
  };

  window.markLeadWaiting = async function (id) {
    const l = ensureLeads().find(x => x.id === id);
    if (!l) return;

    l.status = 'Waiting';
    l.lastContact = leadDateTime();

    await save();

    openLeadManager();
    render();
  };

  window.markLeadBooked = async function (id) {
    const l = ensureLeads().find(x => x.id === id);
    if (!l) return;

    l.status = 'Booked';
    l.bookedAt = leadDateTime();
    l.lastContact = leadDateTime();

    await save();

    openLeadManager();
    render();
  };

  window.closeLead = async function (id) {
    const l = ensureLeads().find(x => x.id === id);
    if (!l) return;

    if (!confirm('Close this lead?')) return;

    l.status = 'Closed';

    await save();

    closeModal();
    render();
  };

  window.leadWhatsApp = function (id) {
    const l = ensureLeads().find(x => x.id === id);
    if (!l || !l.phone) return;

    const phone = whatsappPhone(l.phone);

    let msg = `Hi ${l.name || ''} 🤍 `;

    if (l.interest) {
      msg += `刚刚你有询问我们 ${l.interest}，`;
    } else {
      msg += `刚刚你有询问我们，`;
    }

    msg += `如果还想了解或安排时间，可以直接跟我们说哦 😊`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      '_blank'
    );
  };

  function injectLeadsHome() {
    if (typeof page === 'undefined' || page !== 'home') return;

    const view = document.getElementById('view');
    if (!view) return;

    if (document.getElementById('leadsHomeCard')) return;

    view.insertAdjacentHTML('beforeend', leadsHomeHTML());
  }

  const originalRender = window.render;

  if (typeof originalRender === 'function') {
    window.render = function () {
      originalRender();
      injectLeadsHome();
    };
  }

  setTimeout(function () {
    ensureLeads();
    injectLeadsHome();
  }, 600);

})();
