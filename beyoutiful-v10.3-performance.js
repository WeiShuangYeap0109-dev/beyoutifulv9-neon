/* =========================================================
   BEYOUTIFUL V10.5 — MONTHLY PERFORMANCE STATEMENT

   FINAL PERFORMANCE RULES

   01 SALES
   - Only normal single-service sales
   - billing === '单次使用'

   02 PACKAGE SALES
   - Package initial payment / deposit
   - Package payment balance
   - Count ACTUAL amount received on that date
   - Do NOT use full package price
   - Initial package payment staff = item.staff
   - Payment Balance staff = paymentBy

   03 PACKAGE USAGE
   - Performance Value manually entered by owner

   COMMISSION
   - Remains manually entered
   ========================================================= */

(function () {

  function perfOwner() {
    return currentUser?.role === 'owner';
  }

  function sameStaff(a, b) {
    return String(a || '')
      .replace(/\s+/g, '')
      .toLowerCase() ===
      String(b || '')
        .replace(/\s+/g, '')
        .toLowerCase();
  }

  function perfCustomerName(x) {
    if (!x) return '—';

    const customer = (data.customers || [])
      .find(c =>
        String(c.id) ===
        String(x.customerId)
      );

    if (customer?.name) return customer.name;

    const order = (data.orders || [])
      .find(o =>
        String(o.id) ===
        String(x.orderId)
      );

    return (
      x.customerName ||
      order?.customerName ||
      '—'
    );
  }


  /* =========================================================
     COMMISSION LOOKUP
     ========================================================= */

  function perfCommission(
    orderId,
    staff,
    type,
    usageId
  ) {

    return (data.commissions || [])

      .filter(c => {

        if (
          orderId &&
          String(c.orderId || '') !==
          String(orderId)
        ) return false;

        if (!sameStaff(c.staff, staff)) {
          return false;
        }

        if (c.type !== type) {
          return false;
        }

        if (
          usageId &&
          String(c.usageId || '') !==
          String(usageId)
        ) return false;

        return true;
      })

      .reduce(
        (n, c) =>
          n + Number(c.amount || 0),
        0
      );
  }


  /* =========================================================
     01 SALES
     ONLY NORMAL SINGLE SALES
     ========================================================= */

  function perfSalesRows(month, staff) {

    const result = [];

    for (const order of (data.orders || [])) {

      if (
        monthKey(order.date) !== month
      ) continue;


      /*
       * IMPORTANT:
       * Package purchase and Payment Balance
       * DO NOT enter Sales.
       */

      if (
        order.billing !== '单次使用'
      ) continue;


      const items =
        Array.isArray(order.items) &&
        order.items.length

          ? order.items

          : [{

              service:
                order.service || '',

              staff:
                order.staff || '',

              amount:
                Number(
                  order.originalAmount ??
                  order.amount ??
                  0
                )
            }];


      const matching =
        items.filter(i =>
          sameStaff(
            i.staff,
            staff
          )
        );


      if (!matching.length) continue;


      const originalTotal =
        items.reduce(
          (n, i) =>
            n +
            Number(
              i.amount || 0
            ),
          0
        );


      const finalAmount =
        Number(
          order.amount || 0
        );


      for (const item of matching) {

        let amount = 0;


        if (originalTotal > 0) {

          amount =
            Number(
              item.amount || 0
            ) /
            originalTotal *
            finalAmount;

        } else {

          amount =
            finalAmount /
            matching.length;
        }


        result.push({

          date:
            order.date,

          orderId:
            order.id,

          customerId:
            order.customerId,

          customerName:
            order.customerName,

          service:
            item.service ||
            order.service ||
            '',

          staff:
            item.staff ||
            staff,

          amount,

          commission:
            perfCommission(
              order.id,
              item.staff || staff,
              'Order'
            )
        });
      }
    }


    return result.sort(
      (a, b) =>
        String(a.date || '')
          .localeCompare(
            String(b.date || '')
          )
    );
  }


  /* =========================================================
     02 PACKAGE SALES

     ACTUAL PACKAGE CASH RECEIVED

     Example RM688 package:

     Day 1 Deposit RM300
       Package Sales = RM300

     Day 2 Payment RM200
       Package Sales = RM200

     Day 3 Balance RM188
       Package Sales = RM188

     Total Package Sales = RM688
     ========================================================= */

  function perfPackageSaleRows(
    month,
    staff
  ) {

    const result = [];


    for (const order of (data.orders || [])) {

      if (
        monthKey(order.date) !== month
      ) continue;


      /* =====================================================
         A. INITIAL PACKAGE PAYMENT / DEPOSIT
         ===================================================== */

      if (
        order.billing === '购买配套'
      ) {

        const items =
          Array.isArray(order.items) &&
          order.items.length

            ? order.items

            : [{

                service:
                  order.service || '',

                staff:
                  order.staff || '',

                amount:
                  Number(
                    order.amount || 0
                  )
              }];


        const matching =
          items.filter(i =>
            sameStaff(
              i.staff,
              staff
            )
          );


        if (!matching.length) {
          continue;
        }


        /*
         * IMPORTANT:
         *
         * order.amount =
         * actual money received today
         *
         * NOT packagePrice.
         */

        const actualReceived =
          Number(
            order.amount || 0
          );


        const itemTotal =
          items.reduce(
            (n, i) =>
              n +
              Number(
                i.amount || 0
              ),
            0
          );


        for (const item of matching) {

          let amount = 0;


          if (
            items.length === 1
          ) {

            amount =
              actualReceived;

          } else if (
            itemTotal > 0
          ) {

            amount =
              Number(
                item.amount || 0
              ) /
              itemTotal *
              actualReceived;

          } else {

            amount =
              actualReceived /
              matching.length;
          }


          result.push({

            date:
              order.date,

            orderId:
              order.id,

            customerId:
              order.customerId,

            customerName:
              order.customerName,

            service:
              item.service ||
              order.service ||
              'Package',

            staff:
              item.staff ||
              staff,

            amount,

            commission:
              perfCommission(
                order.id,
                item.staff || staff,
                'Package Sale'
              ),

            paymentKind:
              order.paymentKind ||
              'package_initial'
          });
        }


        continue;
      }


      /* =====================================================
         B. PACKAGE PAYMENT BALANCE
         SECOND / THIRD / FINAL PAYMENT
         ===================================================== */

      if (
        order.billing ===
        'Payment Balance'
      ) {

        /*
         * Balance belongs to
         * the person who received payment.
         */

        if (
          !sameStaff(
            order.paymentBy,
            staff
          )
        ) {
          continue;
        }


        result.push({

          date:
            order.date,

          orderId:
            order.id,

          customerId:
            order.customerId,

          customerName:
            order.customerName,

          service:
            order.service ||
            'Package Payment Balance',

          staff:
            order.paymentBy ||
            staff,

          /*
           * Actual money received
           * on this date.
           */

          amount:
            Number(
              order.amount || 0
            ),

          commission:
            perfCommission(
              order.id,
              order.paymentBy || staff,
              'Package Sale'
            ),

          paymentKind:
            order.paymentKind ||
            'package_balance'
        });


        continue;
      }
    }


    return result.sort(
      (a, b) =>
        String(a.date || '')
          .localeCompare(
            String(b.date || '')
          )
    );
  }


  /* =========================================================
     03 PACKAGE USAGE
     ========================================================= */

  function perfUsageRows(
    month,
    staff
  ) {

    return (data.usage || [])

      .filter(u =>
        monthKey(u.date) === month &&
        sameStaff(
          u.staff,
          staff
        )
      )

      .map(u => ({

        ...u,

        customerName:
          perfCustomerName(u),

        performanceValue:
          Number(
            u.performanceValue || 0
          ),

        commission:
          Number(
            u.commission ??
            perfCommission(
              u.orderId,
              u.staff,
              'Package Use',
              u.id
            ) ??
            0
          )
      }))

      .sort(
        (a, b) =>
          String(a.date || '')
            .localeCompare(
              String(b.date || '')
            )
      );
  }


  /* =========================================================
     PACKAGE SALES BONUS
     ========================================================= */

  function perfBonus(
    month,
    staff
  ) {

    return (data.commissions || [])

      .filter(c =>
        monthKey(c.date) === month &&
        sameStaff(
          c.staff,
          staff
        ) &&
        c.type ===
          'Package Sales Bonus'
      )

      .reduce(
        (n, c) =>
          n +
          Number(
            c.amount || 0
          ),
        0
      );
  }


  /* =========================================================
     MONTH DATA
     ========================================================= */

  function perfData(
    month,
    staff
  ) {

    const sales =
      perfSalesRows(
        month,
        staff
      );


    const packageSales =
      perfPackageSaleRows(
        month,
        staff
      );


    const usage =
      perfUsageRows(
        month,
        staff
      );


    const bonus =
      perfBonus(
        month,
        staff
      );


    const salesValue =
      sales.reduce(
        (n, x) =>
          n +
          Number(
            x.amount || 0
          ),
        0
      );


    const packageSalesValue =
      packageSales.reduce(
        (n, x) =>
          n +
          Number(
            x.amount || 0
          ),
        0
      );


    const usageValue =
      usage.reduce(
        (n, x) =>
          n +
          Number(
            x.performanceValue || 0
          ),
        0
      );


    const salesCommission =
      sales.reduce(
        (n, x) =>
          n +
          Number(
            x.commission || 0
          ),
        0
      );


    const packageSalesCommission =
      packageSales.reduce(
        (n, x) =>
          n +
          Number(
            x.commission || 0
          ),
        0
      );


    const usageCommission =
      usage.reduce(
        (n, x) =>
          n +
          Number(
            x.commission || 0
          ),
        0
      );


    return {

      sales,

      packageSales,

      usage,

      bonus,

      salesValue,

      packageSalesValue,

      usageValue,

      salesCommission,

      packageSalesCommission,

      usageCommission,

      totalCommission:
        salesCommission +
        packageSalesCommission +
        usageCommission +
        bonus
    };
  }


  /* =========================================================
     SCREEN SECTION
     ========================================================= */

  function perfSection(
    title,
    rows,
    type
  ) {

    const body =
      rows.length

        ? rows.map(x => {

            const performanceValue =
              type === 'usage'

                ? Number(
                    x.performanceValue ||
                    0
                  )

                : Number(
                    x.amount || 0
                  );


            const editAction =
              type === 'usage'

                ? `openPerformanceUsageEdit('${esc(x.id)}')`

                : `openOrderCommission('${esc(x.orderId)}')`;


            return `

              <div
                class="row"
                style="
                  align-items:flex-start;
                  gap:12px
                "
              >

                <div
                  style="
                    min-width:0;
                    flex:1
                  "
                >

                  <b>
                    ${esc(x.date || '')}
                    ·
                    ${esc(
                      perfCustomerName(x)
                    )}
                  </b>


                  <div class="muted">
                    ${esc(
                      x.service || '—'
                    )}
                  </div>


                  <div
                    class="muted"
                    style="margin-top:4px"
                  >

                    Performance
                    ${money(
                      performanceValue
                    )}

                    ·

                    Commission
                    ${money(
                      x.commission || 0
                    )}

                  </div>

                </div>


                <button
                  class="btn"
                  onclick="${editAction}"
                >
                  Edit
                </button>

              </div>
            `;
          }).join('')

        : `

            <div class="empty">
              No records.
            </div>
          `;


    return `

      <div
        class="card"
        style="padding:14px"
      >

        <div
          class="section-head"
          style="margin-bottom:8px"
        >

          <b>
            ${title}
          </b>

          <span class="muted">
            ${rows.length} records
          </span>

        </div>

        ${body}

      </div>
    `;
  }


  /* =========================================================
     EDIT PACKAGE USAGE
     ========================================================= */

  window.openPerformanceUsageEdit =
    function (id) {

      if (!perfOwner()) return;


      const usage =
        (data.usage || [])
          .find(
            x =>
              String(x.id) ===
              String(id)
          );


      if (!usage) {

        return toast(
          '找不到 Usage 记录'
        );
      }


      const existingCommission =
        Number(
          usage.commission ??
          perfCommission(
            usage.orderId,
            usage.staff,
            'Package Use',
            usage.id
          ) ??
          0
        );


      openModal(

        'Package Usage · ' +
        esc(
          perfCustomerName(
            usage
          )
        ),

        `

          <form
            class="form"
            onsubmit="
              savePerformanceUsage(
                event,
                '${esc(id)}'
              )
            "
          >

            <div class="muted">

              ${esc(
                usage.date || ''
              )}

              ·

              ${esc(
                usage.service || ''
              )}

              ·

              ${esc(
                usage.staff || ''
              )}

            </div>


            <div class="field">

              <label>
                Package Usage Value (RM)
              </label>

              <input
                id="perfUsageValue"
                type="number"
                min="0"
                step="0.01"
                value="${
                  Number(
                    usage.performanceValue ||
                    0
                  )
                }"
              >

            </div>


            <div class="field">

              <label>
                Usage Commission (RM)
              </label>

              <input
                id="perfUsageCommission"
                type="number"
                min="0"
                step="0.01"
                value="${
                  existingCommission
                }"
              >

            </div>


            <button class="btn dark">
              ✓ Save
            </button>

          </form>
        `
      );
    };


  window.savePerformanceUsage =
    async function (
      e,
      id
    ) {

      e.preventDefault();

      if (!perfOwner()) return;


      const usage =
        (data.usage || [])
          .find(
            x =>
              String(x.id) ===
              String(id)
          );


      if (!usage) {

        return toast(
          '找不到 Usage 记录'
        );
      }


      const value =
        Math.max(
          0,
          Number(
            document
              .getElementById(
                'perfUsageValue'
              )
              ?.value || 0
          )
        );


      const commission =
        Math.max(
          0,
          Number(
            document
              .getElementById(
                'perfUsageCommission'
              )
              ?.value || 0
          )
        );


      usage.performanceValue =
        value;

      usage.commission =
        commission;


      data.commissions =
        (data.commissions || [])
          .filter(c =>
            !(
              c.type ===
                'Package Use' &&

              String(
                c.usageId || ''
              ) ===
              String(
                usage.id
              )
            )
          );


      if (usage.staff) {

        data.commissions.push({

          id:
            'C' +
            Date.now() +
            Math.floor(
              Math.random() *
              10000
            ),

          orderId:
            usage.orderId,

          usageId:
            usage.id,

          customerId:
            usage.customerId,

          staff:
            usage.staff,

          service:
            usage.service || '',

          amount:
            commission,

          date:
            usage.date ||
            localDate(),

          type:
            'Package Use'
        });
      }


      await save();

      closeModal();

      render();

      toast(
        'Usage Performance 已保存'
      );


      setTimeout(
        () =>
          openStaffPerformanceStatement(
            usage.staff
          ),
        100
      );
    };


  /* =========================================================
     PERFORMANCE STATEMENT
     ========================================================= */

  window.openStaffPerformanceStatement =
    function (staff) {

      if (!perfOwner()) return;


      const month =
        window.performanceMonth ||
        currentMonthKey();


      const x =
        perfData(
          month,
          staff
        );


      openModal(

        `${staff} · ${monthLabel(month)}`,

        `

          <div class="form">


            <div
              class="card"
              style="padding:14px"
            >

              <div class="muted">
                MONTHLY PERFORMANCE STATEMENT
              </div>

              <div
                style="
                  font-size:22px;
                  font-weight:800;
                  margin-top:4px
                "
              >
                ${esc(staff)}
              </div>

              <div class="muted">
                ${esc(
                  monthLabel(month)
                )}
              </div>

            </div>


            <div
              class="card"
              style="padding:14px"
            >

              <b>
                PERFORMANCE SUMMARY
              </b>


              <div
                class="summary"
                style="margin-top:10px"
              >

                <div>

                  <span>
                    Sales
                  </span>

                  <b>
                    ${money(
                      x.salesValue
                    )}
                  </b>

                </div>


                <div>

                  <span>
                    Package Sales
                  </span>

                  <b>
                    ${money(
                      x.packageSalesValue
                    )}
                  </b>

                </div>


                <div>

                  <span>
                    Package Usage
                  </span>

                  <b>
                    ${money(
                      x.usageValue
                    )}
                  </b>

                </div>

              </div>

            </div>


            ${
              perfSection(
                '01 · SALES',
                x.sales,
                'sales'
              )
            }


            ${
              perfSection(
                '02 · PACKAGE SALES',
                x.packageSales,
                'package'
              )
            }


            ${
              perfSection(
                '03 · PACKAGE USAGE',
                x.usage,
                'usage'
              )
            }


            <div
              class="card"
              style="padding:14px"
            >

              <b>
                COMMISSION SUMMARY
              </b>


              <div
                class="summary"
                style="margin-top:10px"
              >

                <div>

                  <span>
                    Sales Commission
                  </span>

                  <b>
                    ${money(
                      x.salesCommission
                    )}
                  </b>

                </div>


                <div>

                  <span>
                    Package Sale Commission
                  </span>

                  <b>
                    ${money(
                      x.packageSalesCommission
                    )}
                  </b>

                </div>


                <div>

                  <span>
                    Usage Commission
                  </span>

                  <b>
                    ${money(
                      x.usageCommission
                    )}
                  </b>

                </div>


                <div>

                  <span>
                    Package Sales Bonus
                  </span>

                  <b>
                    ${money(
                      x.bonus
                    )}
                  </b>

                </div>

              </div>


              <div
                style="
                  margin-top:14px;
                  padding-top:14px;
                  border-top:1px solid #ddd;
                  display:flex;
                  justify-content:space-between;
                  gap:15px;
                  align-items:center
                "
              >

                <b>
                  TOTAL COMMISSION / BONUS
                </b>

                <b
                  style="
                    font-size:22px;
                    white-space:nowrap
                  "
                >
                  ${money(
                    x.totalCommission
                  )}
                </b>

              </div>

            </div>


            <button
              class="btn dark"
              onclick="
                printStaffPerformanceStatement(
                  '${esc(staff)}',
                  '${esc(month)}'
                )
              "
            >
              PDF / PRINT
            </button>


          </div>
        `
      );
    };


  /* =========================================================
     PDF TABLE
     ========================================================= */

  function pdfTable(
    title,
    rows,
    type
  ) {

    const body =
      rows.length

        ? rows.map(x => {

            const value =
              type === 'usage'

                ? Number(
                    x.performanceValue ||
                    0
                  )

                : Number(
                    x.amount || 0
                  );


            return `

              <tr>

                <td>
                  ${esc(
                    x.date || ''
                  )}
                </td>

                <td>
                  ${esc(
                    perfCustomerName(x)
                  )}
                </td>

                <td>
                  ${esc(
                    x.service || '—'
                  )}
                </td>

                <td class="money">
                  ${money(value)}
                </td>

                <td class="money">
                  ${money(
                    x.commission || 0
                  )}
                </td>

              </tr>
            `;
          }).join('')

        : `

            <tr>

              <td
                colspan="5"
                class="empty"
              >
                No records.
              </td>

            </tr>
          `;


    return `

      <h2>
        ${title}
      </h2>


      <table>

        <thead>

          <tr>

            <th>
              Date
            </th>

            <th>
              Customer
            </th>

            <th>
              Service
            </th>

            <th class="money">
              Performance
            </th>

            <th class="money">
              Commission
            </th>

          </tr>

        </thead>


        <tbody>
          ${body}
        </tbody>

      </table>
    `;
  }


  /* =========================================================
     PRINT / PDF
     ========================================================= */

  window.printStaffPerformanceStatement =
    function (
      staff,
      month
    ) {

      if (!perfOwner()) return;


      const x =
        perfData(
          month,
          staff
        );


      const html = `

        <!doctype html>

        <html>

        <head>

          <meta charset="UTF-8">


          <title>
            ${esc(staff)}
            ·
            ${esc(
              monthLabel(month)
            )}
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

              font-size:12px;
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

              margin:
                28px 0 18px;
            }


            .staff {

              font-size:20px;

              font-weight:800;
            }


            h2 {

              font-size:13px;

              letter-spacing:.5px;

              margin:
                26px 0 6px;
            }


            table {

              width:100%;

              border-collapse:
                collapse;
            }


            th {

              text-align:left;

              font-size:10px;

              color:#666;

              border-bottom:
                1px solid #111;

              padding:7px 5px;
            }


            td {

              padding:7px 5px;

              border-bottom:
                1px solid #ddd;

              vertical-align:top;
            }


            .money {

              text-align:right;

              white-space:nowrap;
            }


            .summary {

              display:grid;

              grid-template-columns:
                repeat(3,1fr);

              gap:10px;

              margin:
                16px 0 22px;
            }


            .box {

              border:
                1px solid #ddd;

              padding:10px;
            }


            .box span {

              display:block;

              color:#666;

              font-size:10px;
            }


            .box b {

              display:block;

              font-size:16px;

              margin-top:4px;
            }


            .totals {

              width:340px;

              margin-left:auto;

              margin-top:24px;
            }


            .total-row {

              display:flex;

              justify-content:
                space-between;

              gap:20px;

              padding:4px 0;
            }


            .grand {

              border-top:
                1px solid #111;

              margin-top:7px;

              padding-top:9px;

              font-size:15px;

              font-weight:800;
            }


            .footer {

              margin-top:40px;

              color:#777;

              font-size:10px;
            }


            .empty {

              text-align:center;

              color:#777;
            }


            @media print {

              body {
                padding:10px;
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
              MONTHLY PERFORMANCE STATEMENT
            </div>

            <div class="staff">
              ${esc(staff)}
            </div>

            <div>
              ${esc(
                monthLabel(month)
              )}
            </div>

          </div>


          <div class="summary">


            <div class="box">

              <span>
                SALES
              </span>

              <b>
                ${money(
                  x.salesValue
                )}
              </b>

            </div>


            <div class="box">

              <span>
                PACKAGE SALES
              </span>

              <b>
                ${money(
                  x.packageSalesValue
                )}
              </b>

            </div>


            <div class="box">

              <span>
                PACKAGE USAGE
              </span>

              <b>
                ${money(
                  x.usageValue
                )}
              </b>

            </div>


          </div>


          ${
            pdfTable(
              '01 · SALES',
              x.sales,
              'sales'
            )
          }


          ${
            pdfTable(
              '02 · PACKAGE SALES',
              x.packageSales,
              'package'
            )
          }


          ${
            pdfTable(
              '03 · PACKAGE USAGE',
              x.usage,
              'usage'
            )
          }


          <div class="totals">


            <div class="total-row">

              <span>
                Sales Commission
              </span>

              <b>
                ${money(
                  x.salesCommission
                )}
              </b>

            </div>


            <div class="total-row">

              <span>
                Package Sale Commission
              </span>

              <b>
                ${money(
                  x.packageSalesCommission
                )}
              </b>

            </div>


            <div class="total-row">

              <span>
                Usage Commission
              </span>

              <b>
                ${money(
                  x.usageCommission
                )}
              </b>

            </div>


            <div class="total-row">

              <span>
                Package Sales Bonus
              </span>

              <b>
                ${money(
                  x.bonus
                )}
              </b>

            </div>


            <div
              class="
                total-row
                grand
              "
            >

              <span>
                TOTAL COMMISSION / BONUS
              </span>

              <span>
                ${money(
                  x.totalCommission
                )}
              </span>

            </div>


          </div>


          <div class="footer">

            Beyoutiful Studio & Academy
            ·
            Bukit Mertajam

          </div>


          <script>

            window.onload =
              function () {

                setTimeout(
                  function () {
                    window.print();
                  },
                  300
                );
              };

          <\/script>


        </body>

        </html>
      `;


      const w =
        window.open(
          '',
          '_blank'
        );


      if (!w) {

        alert(
          'Please allow pop-ups to create PDF.'
        );

        return;
      }


      w.document.open();

      w.document.write(html);

      w.document.close();
    };


  /* =========================================================
     STAFF PERFORMANCE CARDS
     ========================================================= */

  function attachPerformanceCards() {

    if (!perfOwner()) return;


    if (
      typeof page === 'undefined' ||
      page !== 'performance'
    ) {
      return;
    }


    const view =
      document.getElementById(
        'view'
      );


    if (!view) return;


    const cards =
      view.querySelectorAll(
        '.grid.stats > .card'
      );


    const staffList =
      STAFF;


    cards.forEach(
      (card, index) => {

        const staff =
          staffList[index];


        if (!staff) return;


        if (
          card.dataset
            .performanceLinked === '1'
        ) {
          return;
        }


        card.dataset
          .performanceLinked = '1';


        card.style.cursor =
          'pointer';


        card.onclick =
          function () {

            openStaffPerformanceStatement(
              staff
            );
          };


        const hint =
          document.createElement(
            'div'
          );


        hint.className =
          'muted';


        hint.style.marginTop =
          '10px';


        hint.innerHTML =
          'View monthly performance →';


        card.appendChild(
          hint
        );
      }
    );
  }


  const originalRenderV105 =
    window.render;


  if (
    typeof originalRenderV105 ===
    'function'
  ) {

    window.render =
      function () {

        const result =
          originalRenderV105.apply(
            this,
            arguments
          );


        setTimeout(
          attachPerformanceCards,
          0
        );


        return result;
      };
  }


  setTimeout(
    attachPerformanceCards,
    700
  );

})();
