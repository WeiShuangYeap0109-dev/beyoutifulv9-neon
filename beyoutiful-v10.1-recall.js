/* BEYOUTIFUL V10.1 — TODAY'S ACTIONS / RECALL */

(function () {

  function recallDaysBetween(a, b) {
    if (!a || !b) return 0;
    return Math.floor(
      (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000
    );
  }

  function recallLastService(customerId, matcher) {
    let latest = null;

    (data.orders || []).forEach(o => {
      if (String(o.customerId) !== String(customerId) || !o.date) return;

      const items =
        Array.isArray(o.items) && o.items.length
          ? o.items
          : [{ service: o.service || '' }];

      const hit = items.find(i => matcher(String(i.service || '')));

      if (hit && (!latest || o.date > latest.date)) {
        latest = {
          date: o.date,
          service: hit.service || o.service || ''
        };
      }
    });

    (data.usage || []).forEach(u => {
      if (String(u.customerId) !== String(customerId) || !u.date) return;

      if (
        matcher(String(u.service || '')) &&
        (!latest || u.date > latest.date)
      ) {
        latest = {
          date: u.date,
          service: u.service || ''
        };
      }
    });

    return latest;
  }

  window.recallActions = function () {
    const today = localDate();
    const actions = [];

    (data.customers || []).forEach(customer => {

      /* FACIAL — 35 DAYS */
      const facial = recallLastService(
        customer.id,
        s =>
          /清洁|facial|oxygen|注氧|rejuvenation|焕肤|bb肌|拨筋/i.test(s)
      );

      if (facial) {
        const days = recallDaysBetween(facial.date, today);

        if (days >= 35) {
          actions.push({
            type: 'facial',
            priority: days >= 60 ? 1 : 2,
            customer,
            title: 'Facial Recall',
            detail: facial.service + ' · ' + days + ' days ago'
          });
        }
      }

      /* BROW — 300 DAYS */
      const brow = recallLastService(
        customer.id,
        s => /眉|brow|ombr/i.test(s)
      );

      if (brow) {
        const days = recallDaysBetween(brow.date, today);

        if (days >= 300) {
          actions.push({
            type: 'brow',
            priority: days >= 365 ? 1 : 2,
            customer,
            title: 'Brow Touch-up',
            detail: brow.service + ' · ' + days + ' days ago'
          });
        }
      }
    });

    /* PACKAGE */
    (data.packages || []).forEach(p => {

      const customer = (data.customers || []).find(
        c => String(c.id) === String(p.customerId)
      );

      if (!customer) return;

      if (p.packageType === 'value') {

        const balance = Number(p.valueBalance || 0);

        if (balance > 0 && balance <= 100) {
          actions.push({
            type: 'package',
            priority: 2,
            customer,
            title: 'Package Balance',
            detail:
              (p.service || 'Any Service') +
              ' · ' +
              money(balance) +
              ' left'
          });
        }

      } else {

        const remaining =
          Math.max(
            0,
            Number(p.times || 0) - Number(p.used || 0)
          );

        if (remaining === 1) {
          actions.push({
            type: 'package',
            priority: 1,
            customer,
            title: 'Package · Last 1',
            detail:
              (p.service || 'Package') +
              ' · 1 time left'
          });
        }
      }
    });

    return actions.sort(
      (a, b) =>
        a.priority - b.priority ||
        String(a.customer.name || '').localeCompare(
          String(b.customer.name || '')
        )
    );
  };


  function recallMessage(action) {

    const name = action.customer.name || '顾客';

    if (action.type === 'facial') {

      return `Hi ${name} 🤍

好久不见～看到您上一次在 Beyoutiful 做护理已经隔了一段时间。

如果最近想安排皮肤护理，可以告诉我们您方便的日期和时间，我们帮您看看预约 😊

Beyoutiful Studio & Academy`;

    }

    if (action.type === 'package') {

      return `Hi ${name} 🤍

提醒您一下，您在 Beyoutiful 的配套目前只剩最后一次／余额不多了。

想安排时间使用的话，可以直接回复我们日期和时间 😊

Beyoutiful Studio & Academy`;

    }

    return `Hi ${name} 🤍

提醒您一下，上一次的眉毛护理已经有一段时间了。

如果最近觉得颜色或眉形需要整理，可以发一张现在的眉毛照片给我们看看，我们先帮您判断是否需要补色 😊

Beyoutiful Studio & Academy`;
  }


  window.sendRecallWhatsApp = function (type, customerId) {

    const action = recallActions().find(
      a =>
        a.type === type &&
        String(a.customer.id) === String(customerId)
    );

    if (!action) {
      return toast('这项提醒已经不在待办名单');
    }

    if (!action.customer.phone) {
      return toast('这个顾客没有电话号码');
    }

    const phone = whatsappPhone(action.customer.phone);

    window.open(
      'https://wa.me/' +
        phone +
        '?text=' +
        encodeURIComponent(recallMessage(action)),
      '_blank'
    );
  };


  function todayActionsHTML() {

    const list = recallActions();

    const facial =
      list.filter(a => a.type === 'facial').length;

    const packages =
      list.filter(a => a.type === 'package').length;

    const brow =
      list.filter(a => a.type === 'brow').length;

    const priority =
      list.filter(a => a.priority === 1).length;


    return `
      <div class="card section" id="todayActionsCard">

        <div class="section-head">

          <div>
            <h3 style="margin:0">TODAY'S ACTIONS</h3>

            <div class="muted">
              自动从顾客消费与配套记录计算 · WhatsApp 由员工确认后发送
            </div>
          </div>

          <span class="pill">
            ${list.length} actions
          </span>

        </div>


        <div class="grid stats" style="margin-bottom:12px">

          <div>
            <div class="stat">${facial}</div>
            <div class="muted">Facial Recall</div>
          </div>

          <div>
            <div class="stat">${packages}</div>
            <div class="muted">Package</div>
          </div>

          <div>
            <div class="stat">${brow}</div>
            <div class="muted">Brow Touch-up</div>
          </div>

          <div>
            <div class="stat">${priority}</div>
            <div class="muted">Priority</div>
          </div>

        </div>


        ${
          list.length
            ? list
                .slice(0, 30)
                .map(
                  a => `
                    <div class="row">

                      <div>

                        <b>${esc(a.customer.name)}</b>

                        <span class="pill">
                          ${esc(a.title)}
                        </span>

                        <div class="muted">
                          ${esc(a.detail)}
                        </div>

                      </div>

                      <button
                        class="btn"
                        onclick="sendRecallWhatsApp(
                          '${a.type}',
                          '${esc(a.customer.id)}'
                        )"
                      >
                        📲 WhatsApp
                      </button>

                    </div>
                  `
                )
                .join('')
            : `
                <div class="empty">
                  今天没有需要跟进的顾客 🎉
                </div>
              `
        }

      </div>
    `;
  }


  function injectRecallPanel() {

    if (typeof page === 'undefined' || page !== 'home') {
      return;
    }

    const view = document.getElementById('view');

    if (!view) return;

    if (document.getElementById('todayActionsCard')) {
      return;
    }

    view.insertAdjacentHTML(
      'beforeend',
      todayActionsHTML()
    );
  }


  const originalRender = window.render;

  window.render = function () {

    const result =
      originalRender.apply(this, arguments);

    try {
      injectRecallPanel();
    } catch (error) {
      console.error(
        'Beyoutiful Recall:',
        error
      );
    }

    return result;
  };


  setTimeout(function () {

    try {
      injectRecallPanel();
    } catch (error) {
      console.error(error);
    }

  }, 500);

})();
