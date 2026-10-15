ssName="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C7359C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="font-bold text-gray-900 text-2xl flex items-center gap-2">
            <Gift className="size-6 text-[#C7359C]" />
            Loyalty Program
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Earn rate: {loyaltySettings.standardPointsPerRs} pt/PKR &nbsp;·&nbsp;
            Redeem rate: {loyaltySettings.redemptionRate} PKR/pt
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSales}
          className="gap-2"
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-10">
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="size-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="size-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Star className="size-4" /> Transaction Logs
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="size-4" /> Members
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpiCard(
              'Total Points Issued',
              totalPointsIssued.toLocaleString(),
              'all time earned',
              <Coins className="size-4 text-[#C7359C]" />,
              true
            )}
            {kpiCard(
              'Points Redeemed',
              totalPointsRedeemed.toLocaleString(),
              'converted to discounts',
              <ArrowDownRight className="size-4 text-emerald-600" />
            )}
            {kpiCard(
              'Outstanding Balance',
              totalBalance.toLocaleString(),
              'unredeemed points',
              <Gift className="size-4 text-amber-500" />
            )}
            {kpiCard(
              'Redemption Rate',
              `${redemptionRate}%`,
              'of issued points redeemed',
              <TrendingUp className="size-4 text-blue-500" />
            )}
            {kpiCard(
              'Active Members',
              activeMembers.toLocaleString(),
              'customers with points',
              <Users className="size-4 text-purple-500" />
            )}
            {kpiCard(
              'PKR Saved via Points',
              `PKR ${totalPkrSaved.toLocaleString()}`,
              'total loyalty discounts',
              <Award className="size-4 text-rose-500" />
            )}
          </div>

          {/* Points Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Points Activity — Last 30 Days</CardTitle>
              <CardDescription>Daily earned vs redeemed points</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="redeemGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    interval={4}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="earned"
                    name="Points Earned"
                    stroke={PRIMARY}
                    strokeWidth={2}
                    fill="url(#earnGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="redeemed"
                    name="Points Redeemed"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#redeemGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Top 5 Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="size-4 text-[#C7359C]" /> Top Members by Balance
                </CardTitle>
                <CardDescription>Customers with highest outstanding points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customerStats.slice(0, 5).map((c, i) => (
                    <div key={c.phone || c.name} className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-[#C7359C] text-sm">
                          {c.balance.toLocaleString()} pts
                        </p>
                        <p className="text-xs text-gray-400">{c.txCount} orders</p>
                      </div>
                    </div>
                  ))}
                  {customerStats.length === 0 && (
                    <p className="text-gray-400 text-sm text-center py-4">
                      No loyalty activity yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Points Breakdown Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Points Distribution</CardTitle>
                <CardDescription>Redeemed vs outstanding balance</CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <PieChart width={160} height={160}>
                      <Pie
                        data={pieData}
                        cx={75}
                        cy={75}
                        innerRadius={45}
                        outerRadius={72}
                        dataKey="value"
                        strokeWidth={2}
                      >
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    </PieChart>
                    <div className="space-y-3">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <div>
                            <p className="text-sm font-medium">{d.name}</p>
                            <p className="text-xs text-gray-500">{d.value.toLocaleString()} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ANALYTICS ── */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Date filter pills */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="size-4 text-gray-400 flex-shrink-0" />
                <DatePill range="today" active={dateRange} onClick={setDateRange} label="Today" />
                <DatePill range="7d" active={dateRange} onClick={setDateRange} label="Last 7 Days" />
                <DatePill range="30d" active={dateRange} onClick={setDateRange} label="Last 30 Days" />
                <DatePill range="mtd" active={dateRange} onClick={setDateRange} label="This Month" />
                <DatePill range="custom" active={dateRange} onClick={setDateRange} label="Custom" />
                {dateRange === 'custom' && (
                  <div className="flex items-center gap-2 ml-2">
                    <Input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="h-8 w-36 text-sm"
                    />
                    <span className="text-gray-400 text-sm">→</span>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="h-8 w-36 text-sm"
                    />
                  </div>
                )}
                <span className="ml-auto text-xs text-gray-400">
                  {filteredTx.length} transactions
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Analytics KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCard(
              'Points Earned',
              filteredEarned.toLocaleString(),
              'in selected period',
              <ArrowUpRight className="size-4 text-[#C7359C]" />,
              true
            )}
            {kpiCard(
              'Points Redeemed',
              filteredRedeemed.toLocaleString(),
              'in selected period',
              <ArrowDownRight className="size-4 text-emerald-600" />
            )}
            {kpiCard(
              'PKR Discount Given',
              `PKR ${filteredDiscount.toLocaleString()}`,
              'via loyalty redemptions',
              <Award className="size-4 text-amber-500" />
            )}
            {kpiCard(
              'Active Customers',
              filteredMembers.toLocaleString(),
              'with loyalty transactions',
              <Users className="size-4 text-blue-500" />
            )}
          </div>

          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Points Activity Trend</CardTitle>
              <CardDescription>Earned vs redeemed per day in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analyticsTrend} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={analyticsTrend.length > 15 ? Math.floor(analyticsTrend.length / 10) : 0}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="earned" name="Points Earned" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="redeemed" name="Points Redeemed" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top customers in period */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Top Earners in Period</CardTitle>
                  <CardDescription>Customers who earned the most points</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      filteredTx.map(t => ({
                        Date: new Date(t.date).toLocaleDateString(),
                        Customer: t.customer,
                        Phone: t.phone,
                        'Sale ID': t.saleId,
                        'Purchase Amount': t.purchaseAmount,
                        'Points Earned': t.pointsEarned,
                        'Points Redeemed': t.pointsRedeemed,
                        'PKR Discount': t.loyaltyDiscount,
                      })),
                      `loyalty-analytics-${new Date().toISOString().split('T')[0]}.csv`
                    )
                  }
                >
                  <Download className="size-4 mr-1.5" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Aggregate by customer within filtered period */}
              {(() => {
                const map = new Map<string, { name: string; phone: string; earned: number; redeemed: number; discount: number }>();
                filteredTx.forEach(t => {
                  const k = t.phone || t.customer;
                  if (!map.has(k)) map.set(k, { name: t.customer, phone: t.phone, earned: 0, redeemed: 0, discount: 0 });
                  const e = map.get(k)!;
                  e.earned += t.pointsEarned;
                  e.redeemed += t.pointsRedeemed;
                  e.discount += t.loyaltyDiscount;
                });
                const top = Array.from(map.values()).sort((a, b) => b.earned - a.earned).slice(0, 8);
                const maxEarned = top[0]?.earned || 1;
                return top.length > 0 ? (
                  <div className="space-y-3">
                    {top.map((c, i) => (
                      <div key={c.phone || c.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[160px]">{c.name}</span>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="text-[#C7359C] font-semibold">{c.earned.toLocaleString()} pts</span>
                            {c.redeemed > 0 && <span className="text-emerald-600">-{c.redeemed.toLocaleString()} redeemed</span>}
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#C7359C]"
                            style={{ width: `${(c.earned / maxEarned) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-6">No activity in this period</p>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TRANSACTION LOGS ── */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Loyalty Transaction Logs</CardTitle>
                  <CardDescription>Complete earn &amp; redeem history</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      filteredTx.map(t => ({
                        Date: new Date(t.date).toLocaleString(),
                        Customer: t.customer,
                        Phone: t.phone,
                        'Sale ID': t.saleId,
                        'Purchase Amount': t.purchaseAmount,
                        'Points Earned': t.pointsEarned,
                        'Points Redeemed': t.pointsRedeemed,
                        'PKR Discount': t.loyaltyDiscount,
                        'Balance After': t.balanceAfter ?? '',
                      })),
                      `loyalty-logs-${new Date().toISOString().split('T')[0]}.csv`
                    )
                  }
                >
                  <Download className="size-4 mr-1.5" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                  <Input
                    placeholder="Search by customer, phone, sale ID..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setLogPage(1); }}
                    className="pl-10 h-9"
                  />
                </div>
                <Select
                  value={txTypeFilter}
                  onValueChange={v => { setTxTypeFilter(v as any); setLogPage(1); }}
                >
                  <SelectTrigger className="w-full sm:w-44 h-9">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Transactions</SelectItem>
                    <SelectItem value="earn">Earn Only</SelectItem>
                    <SelectItem value="redeem">Redeem Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date &amp; Time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Sale ID</TableHead>
                      <TableHead className="text-right">Purchase</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Redeemed</TableHead>
                      <TableHead className="text-right">PKR Disc.</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-gray-400">
                          No loyalty transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedLogs.map((tx, i) => (
                        <TableRow key={`${tx.saleId}-${i}`} className="text-sm">
                          <TableCell className="whitespace-nowrap text-xs text-gray-500">
                            {new Date(tx.date).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">{tx.customer}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-500">{tx.phone || '—'}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-400">{tx.saleId.slice(0, 8)}…</TableCell>
                          <TableCell className="text-right">
                            PKR {tx.purchaseAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {tx.pointsEarned > 0 ? (
                              <Badge className="bg-[#C7359C]/10 text-[#C7359C] border-[#C7359C]/20 font-semibold text-xs">
                                +{tx.pointsEarned.toLocaleString()}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {tx.pointsRedeemed > 0 ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-xs">
                                -{tx.pointsRedeemed.toLocaleString()}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium">
                            {tx.loyaltyDiscount > 0 ? `PKR ${tx.loyaltyDiscount.toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-gray-700">
                            {tx.balanceAfter != null ? tx.balanceAfter.toLocaleString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalLogPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Showing {(logPage - 1) * LOG_PAGE_SIZE + 1}–
                    {Math.min(logPage * LOG_PAGE_SIZE, filteredTx.length)} of {filteredTx.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLogPage(p => Math.max(1, p - 1))}
                      disabled={logPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      {logPage} / {totalLogPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                      disabled={logPage === totalLogPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MEMBERS ── */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Loyalty Members</CardTitle>
                  <CardDescription>All customers with loyalty activity, ranked by balance</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      customerStats.map(c => ({
                        Name: c.name,
                        Phone: c.phone,
                        'Total Purchases (PKR)': c.totalPurchases,
                        'Points Earned': c.pointsEarned,
                        'Points Redeemed': c.pointsRedeemed,
                        'Current Balance': c.balance,
                        'Orders': c.txCount,
                        'Last Active': c.lastActive ? new Date(c.lastActive).toLocaleDateString() : '',
                      })),
                      `loyalty-members-${new Date().toISOString().split('T')[0]}.csv`
                    )
                  }
                >
                  <Download className="size-4 mr-1.5" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[560px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Total Spend</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Redeemed</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead>Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-gray-400">
                          No members yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      customerStats.map((c, i) => (
                        <TableRow key={c.phone || c.name} className="text-sm">
                          <TableCell className="text-gray-400 font-medium">{i + 1}</TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-500">{c.phone || '—'}</TableCell>
                          <TableCell className="text-right">PKR {c.totalPurchases.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-[#C7359C] font-semibold">
                            {c.pointsEarned.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600">
                            {c.pointsRedeemed.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              className={
                                c.balance > 0
                                  ? 'bg-[#C7359C]/10 text-[#C7359C] border-[#C7359C]/20 font-bold'
                                  : 'bg-gray-100 text-gray-400'
                              }
                            >
                              {c.balance.toLocaleString()} pts
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-gray-500">{c.txCount}</TableCell>
                          <TableCell className="text-xs text-gray-400">
                            {c.lastActive ? new Date(c.lastActive).toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs