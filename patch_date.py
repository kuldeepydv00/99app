import re

with open('admin-panel/src/App.tsx', 'r') as f:
    content = f.read()

# 1. Add rawDate to bidsList mapping
content = re.sub(
    r'(id: b\._id \|\| b\.id \|\| `bid_\$\{idx\}_\$\{Date\.now\(\)\}`,\s*date:.*?: \'2026-08-29 09:51:51\',)',
    r'\1\n            rawDate: b.created_at || new Date().toISOString(),',
    content
)

# 2. Add rawDate to resultsList mapping
content = re.sub(
    r'(date: r\.date \|\| r\.created_at \? new Date\(r\.created_at \|\| r\.date\)\.toLocaleDateString\(\) : \'N/A\',)',
    r'\1\n            rawDate: r.created_at || r.date || new Date().toISOString(),',
    content
)

# 3. Update getMarketBreakdown
content = content.replace(
    '''const bDate = b.date || (b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString());
          if (!isDateInRange(bDate, startDate, endDate)) return;''',
    '''const bDate = b.rawDate || b.date || (b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString());
          if (!isDateInRange(bDate, startDate, endDate)) return;'''
)

# 4. Update Bids filtering
content = content.replace(
    '''const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        if (!isDateInRange(b.date, sDate, eDate)) return false;''',
    '''const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        if (!isDateInRange(b.rawDate || b.date, sDate, eDate)) return false;'''
)

# 5. Update Ledger Game History Timeline mapping
content = content.replace(
    '''timeline = [
        ...bidsList.map(b => ({ ...b, type: 'Bid', time: new Date(b.date).getTime() })),
        ...winningsList.map(w => ({ ...w, type: 'Winning', time: new Date(w.date || w.dateOfWinning).getTime() }))
      ]''',
    '''timeline = [
        ...bidsList.map(b => ({ ...b, type: 'Bid', time: new Date(b.rawDate || b.date).getTime() })),
        ...winningsList.map(w => ({ ...w, type: 'Winning', time: new Date(w.rawDate || w.date || w.dateOfWinning).getTime() }))
      ]'''
)

with open('admin-panel/src/App.tsx', 'w') as f:
    f.write(content)
print('Patched successfully!')
