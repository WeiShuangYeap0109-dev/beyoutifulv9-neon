/* =========================================================
   BEYOUTIFUL V10.3 — STAFF PERFORMANCE STATEMENT
   Owner: monthly commission detail / edit / print PDF
   ========================================================= */

(function () {

  function perfOwner() {
    return currentUser?.role === 'owner';
  }

  function perfCustomerName(c) {
    if (!c) return '—';

    const customer = (data.customers || [])
      .find(x => String(x.id) === String(c.customerId));

    if (customer?.name) return customer.name;

    const order = (data.orders || [])
      .find(x => String(x.id) === String(c.orderId));

    return order?.customerName || '—';
  }

  function perfTypeLabel(type) {
    return ({
      'Order': 'Order Commission',
      'Package Use': 'Usage Commission',
      'Package Sale': 'Package Sale Commission',
      'Package Sales Bonus': 'Package Sales Bonus'
    })[type] || type || 'Commission';
  }

  function perfMonthRows(month, staff) {
    return (data.commissions || [])
      .filter(c =>
        monthKey(c.date) === month &&
        String(c.staff || '') === String(staff)
      )
      .slice()
      .sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
      );
  }

  function perfTotals(month, staff) {
    const rows = perfMonthRows(month, staff);

    const sum = type =>
      rows
        .filter(x => x.type === type)
        .reduce((n, x) => n + Number(x.amount || 0), 0);

    const order = sum('Order');
    const usage = sum('Package Use');
    const packageSale = sum('Package Sale');
    const bonus = sum('Package Sales Bonus');

    return {
      order,
      usage,
      packageSale,
      bonus,
      total: order + usage + packageSale + bonus
    };
  }

  window.openStaffPerformanceStatement = function (staff) {
    if (!perfOwner()) return;

    const month = window.performanceMonth || currentMonthKey();
    const rows = perfMonthRows(month, staff);
    const totals = perfTotals(month, staff);

    const list = rows.length
      ? rows.map(c => {

          const customer = perfCustomerName(c);
          const editable = !!c.orderId;

          return `
            <div class="row" style="align-items:flex-start">
              <div style="min-width:0;flex:1">

                <b>
                  ${esc(c.date || '')}
                  ·
                  ${esc(customer)}
                </b>

                <div class="muted">
                  ${esc(c.service || '—')}
                </div>

                <div class="muted">
                  ${esc(perfTypeLabel(c.type))}
                </div>

              </div>

              <div style="text-align:right">

                <b>${money(c.amount || 0)}</b>

                ${
                  editable
                    ? `
                      <div style="margin-top:6px">
                        <button
                          class="btn"
                          onclick="openOrderCommission('${esc(c.orderId)}')"
                        >
                          Edit
                        </button>
                      </div>
                    `
                    : ''
                }

              </div>
            </div>
          `;
        }).join('')
      : `<div class="empty">No commission records for this month.</div>`;

    openModal(
      `${staff} · ${monthLabel(month)}`,
      `
        <div class="form">

          <div class="card" style="padding:14px">

            <div class="muted">
              MONTHLY COMMISSION STATEMENT
            </div>

            <div style="font-size:22px;font-weight:800;margin-top:4px">
              ${esc(staff)}
            </div>

            <div class="muted">
              ${esc(monthLabel(month))}
            </div>

          </div>


          <div class="card" style="padding:14px">

            <div class="summary">

              <div>
                <span>Order Commission</span>
                <b>${money(totals.order)}</b>
              </div>

              <div>
                <span>Usage Commission</span>
                <b>${money(totals.usage)}</b>
              </div>

              <div>
                <span>Package Sale Commission</span>
                <b>${money(totals.packageSale)}</b>
              </div>

              <div>
                <span>Package Sales Bonus</span>
                <b>${money(totals.bonus)}</b>
              </div>

            </div>

            <div
              style="
                margin-top:14px;
                padding-top:14px;
                border-top:1px solid #ddd;
                display:flex;
                justify-content:space-between;
                align-items:center
              "
            >
              <b>TOTAL COMMISSION / BONUS</b>

              <b style="font-size:22px">
                ${money(totals.total)}
              </b>
            </div>

          </div>


          <div class="card" style="padding:14px">

            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:8px
              "
            >
              <b>Customer List</b>

              <span class="muted">
                ${rows.length} records
              </span>
            </div>

            ${list}

          </div>


          <button
            class="btn dark"
            onclick="printStaffPerformanceStatement('${esc(staff)}','${esc(month)}')"
          >
            PDF / PRINT
          </button>

        </div>
      `
    );
  };


  window.printStaffPerformanceStatement = function (staff, month) {
    if (!perfOwner()) return;

    const rows = perfMonthRows(month, staff);
    const totals = perfTotals(month, staff);

    const tableRows = rows.length
      ? rows.map(c => `
          <tr>
            <td>${esc(c.date || '')}</td>
            <td>${esc(perfCustomerName(c))}</td>
            <td>${esc(c.service || '—')}</td>
            <td>${esc(perfTypeLabel(c.type))}</td>
            <td class="money">${money(c.amount || 0)}</td>
          </tr>
        `).join('')
      : `
          <tr>
            <td colspan="5" style="text-align:center">
              No commission records.
            </td>
          </tr>
        `;

    const html = `
      <!DOCTYPE html>
      <html>

      <head>
        <meta charset="UTF-8">

        <title>
          ${esc(staff)} · ${esc(monthLabel(month))}
        </title>

        <style>

          body {
            font-family:
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              Arial,
              sans-serif;

            color:#111;
            padding:32px;
            font-size:13px;
          }

          .brand {
            font-size:24px;
            font-weight:800;
            letter-spacing:1px;
          }

          .sub {
            color:#666;
            margin-top:4px;
          }

          .head {
            margin-top:30px;
            margin-bottom:24px;
          }

          .staff {
            font-size:20px;
            font-weight:800;
          }

          table {
            width:100%;
            border-collapse:collapse;
            margin-top:18px;
          }

          th {
            text-align:left;
            font-size:11px;
            color:#666;
            border-bottom:1px solid #111;
            padding:9px 6px;
          }

          td {
            padding:9px 6px;
            border-bottom:1px solid #ddd;
            vertical-align:top;
          }

          .money {
            text-align:right;
            white-space:nowrap;
          }

          .totals {
            width:320px;
            margin-left:auto;
            margin-top:25px;
          }

          .total-row {
            display:flex;
            justify-content:space-between;
            padding:5px 0;
          }

          .grand {
            border-top:1px solid #111;
            margin-top:8px;
            padding-top:10px;
            font-size:16px;
            font-weight:800;
          }

          .footer {
            margin-top:45px;
            color:#777;
            font-size:11px;
          }

          @media print {
            body {
              padding:10px;
            }

            button {
              display:none;
            }
          }

        </style>
      </head>


      <body>

        <div class="brand">
          BEYOUTIFUL
        </div>

        <div class="sub">
          STUDIO & ACADEMY
        </div>


        <div class="head">

          <div class="sub">
            MONTHLY COMMISSION STATEMENT
          </div>

          <div class="staff">
            ${esc(staff)}
          </div>

          <div>
            ${esc(monthLabel(month))}
          </div>

        </div>


        <table>

          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Type</th>
              <th style="text-align:right">
                Commission
              </th>
            </tr>
          </thead>

          <tbody>
            ${tableRows}
          </tbody>

        </table>


        <div class="totals">

          <div class="total-row">
            <span>Order Commission</span>
            <b>${money(totals.order)}</b>
          </div>

          <div class="total-row">
            <span>Usage Commission</span>
            <b>${money(totals.usage)}</b>
          </div>

          <div class="total-row">
            <span>Package Sale Commission</span>
            <b>${money(totals.packageSale)}</b>
          </div>

          <div class="total-row">
            <span>Package Sales Bonus</span>
            <b>${money(totals.bonus)}</b>
          </div>

          <div class="total-row grand">
            <span>TOTAL</span>
            <span>${money(totals.total)}</span>
          </div>

        </div>


        <div class="footer">
          Beyoutiful Studio & Academy · Bukit Mertajam
        </div>


        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print();
            }, 300);
          };
        <\/script>

      </body>
      </html>
    `;

    const w = window.open('', '_blank');

    if (!w) {
      alert('Please allow pop-ups to create PDF.');
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
  };


  /* =========================================================
     MAKE OWNER STAFF CARDS CLICKABLE
     ========================================================= */

  function attachPerformanceCards() {

    if (!perfOwner()) return;

    if (typeof page === 'undefined' || page !== 'performance') {
      return;
    }

    const view = document.getElementById('view');

    if (!view) return;

    const cards = view.querySelectorAll('.grid.stats > .card');

    const staffList = STAFF;

    cards.forEach((card, index) => {

      const staff = staffList[index];

      if (!staff) return;

      if (card.dataset.performanceLinked === '1') return;

      card.dataset.performanceLinked = '1';

      card.style.cursor = 'pointer';

      card.onclick = function () {
        openStaffPerformanceStatement(staff);
      };

      const hint = document.createElement('div');

      hint.className = 'muted';

      hint.style.marginTop = '10px';

      hint.innerHTML = 'View monthly customer list →';

      card.appendChild(hint);
    });
  }


  const originalRenderV103 = window.render;

  if (typeof originalRenderV103 === 'function') {

    window.render = function () {

      const result =
        originalRenderV103.apply(this, arguments);

      setTimeout(attachPerformanceCards, 0);

      return result;
    };
  }


  setTimeout(
    attachPerformanceCards,
    700
  );

})();
