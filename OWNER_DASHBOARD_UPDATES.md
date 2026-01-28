# Owner Dashboard Updates for Razorpay Route

## Overview
This document outlines the UI/UX changes needed in the owner dashboard to support Razorpay Route with Settlement Hold.

---

## Changes Required

### 1. Tournaments List View

**Current:**
```
Tournament Name | Organizer | Collections | Status | Actions
Test Tournament | John Doe  | ₹5,000     | Active | [Process Payout]
```

**New:**
```
Tournament Name | Organizer | Collections | Held Amount | Status      | Actions
Test Tournament | John Doe  | ₹5,000     | ₹4,750     | Held        | [Release Settlement]
Test Tournament | Jane Smith| ₹10,000    | ₹0         | Released    | [View Details]
```

**Changes:**
- Add "Held Amount" column showing 95% of collections
- Update "Status" to show settlement status: "Held", "Released", "Completed"
- Replace "Process Payout" button with "Release Settlement"
- Disable button if status is "Released" or "Completed"

---

### 2. Tournament Details View

**Add Settlement Section:**

```jsx
<View style={styles.settlementSection}>
  <Text style={styles.sectionTitle}>Settlement Details</Text>
  
  <View style={styles.settlementRow}>
    <Text>Total Collections:</Text>
    <Text style={styles.amount}>₹{tournament.totalCollections}</Text>
  </View>
  
  <View style={styles.settlementRow}>
    <Text>Platform Commission (5%):</Text>
    <Text style={styles.amount}>₹{tournament.totalCollections * 0.05}</Text>
  </View>
  
  <View style={styles.settlementRow}>
    <Text>Organizer Share (95%):</Text>
    <Text style={styles.amount}>₹{tournament.totalCollections * 0.95}</Text>
  </View>
  
  <View style={styles.settlementRow}>
    <Text>Settlement Status:</Text>
    <Badge status={tournament.settlementStatus}>
      {tournament.settlementStatus}
    </Badge>
  </View>
  
  {tournament.settlementStatus === 'held' && (
    <TouchableOpacity 
      style={styles.releaseButton}
      onPress={() => handleReleaseSettlement(tournament.id)}
    >
      <Text style={styles.releaseButtonText}>
        Release Settlement to Organizer
      </Text>
    </TouchableOpacity>
  )}
  
  {tournament.settlementStatus === 'released' && (
    <View style={styles.infoBox}>
      <Text>Settlement released on {formatDate(tournament.settlementReleasedAt)}</Text>
      <Text>Processing time: 1-2 business days</Text>
    </View>
  )}
  
  {tournament.settlementStatus === 'completed' && (
    <View style={styles.successBox}>
      <Text>✅ Settlement completed on {formatDate(tournament.settlementCompletedAt)}</Text>
      <Text>Organizer has received ₹{tournament.totalCollections * 0.95}</Text>
    </View>
  )}
</View>
```

---

### 3. Release Settlement Function

**Implementation:**

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Alert } from 'react-native';

const handleReleaseSettlement = async (tournamentId) => {
  try {
    // Show confirmation dialog
    Alert.alert(
      'Release Settlement',
      'Are you sure you want to release the settlement to the organizer? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            try {
              // Show loading
              setLoading(true);
              
              // Call Cloud Function
              const functions = getFunctions();
              const releaseSettlement = httpsCallable(functions, 'releaseSettlement');
              
              const result = await releaseSettlement({ tournamentId });
              
              if (result.data.success) {
                Alert.alert(
                  'Success',
                  `Released ${result.data.releasedCount} settlements. The organizer will receive funds within 1-2 business days.`,
                  [{ text: 'OK', onPress: () => refreshTournaments() }]
                );
              } else {
                throw new Error('Failed to release settlement');
              }
            } catch (error) {
              console.error('Release settlement error:', error);
              Alert.alert(
                'Error',
                error.message || 'Failed to release settlement. Please try again.'
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

### 4. Settlement Status Badge Component

**Create a reusable badge component:**

```javascript
const SettlementStatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'held':
        return {
          color: '#FFA500',
          backgroundColor: '#FFF3E0',
          icon: '🔒',
          text: 'Held'
        };
      case 'released':
        return {
          color: '#2196F3',
          backgroundColor: '#E3F2FD',
          icon: '🔓',
          text: 'Released'
        };
      case 'completed':
        return {
          color: '#4CAF50',
          backgroundColor: '#E8F5E9',
          icon: '✅',
          text: 'Completed'
        };
      case 'failed':
        return {
          color: '#F44336',
          backgroundColor: '#FFEBEE',
          icon: '❌',
          text: 'Failed'
        };
      default:
        return {
          color: '#9E9E9E',
          backgroundColor: '#F5F5F5',
          icon: '⏳',
          text: 'Pending'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={styles.badgeIcon}>{config.icon}</Text>
      <Text style={[styles.badgeText, { color: config.color }]}>
        {config.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4
  },
  badgeIcon: {
    fontSize: 14
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600'
  }
});
```

---

### 5. Transactions List Updates

**Update transaction display to show Route details:**

```jsx
<View style={styles.transactionCard}>
  <View style={styles.transactionHeader}>
    <Text style={styles.transactionType}>
      {transaction.type === 'collection' ? '💰 Collection' : '💸 Refund'}
    </Text>
    <Text style={styles.transactionAmount}>₹{transaction.amount}</Text>
  </View>
  
  {transaction.type === 'collection' && (
    <View style={styles.splitDetails}>
      <View style={styles.splitRow}>
        <Text style={styles.splitLabel}>Organizer Share (95%):</Text>
        <Text style={styles.splitAmount}>₹{transaction.organizerShare}</Text>
      </View>
      <View style={styles.splitRow}>
        <Text style={styles.splitLabel}>Platform Commission (5%):</Text>
        <Text style={styles.splitAmount}>₹{transaction.platformCommission}</Text>
      </View>
      <View style={styles.splitRow}>
        <Text style={styles.splitLabel}>Transfer Status:</Text>
        <SettlementStatusBadge status={transaction.transferStatus} />
      </View>
    </View>
  )}
  
  {transaction.settlementHeld && (
    <View style={styles.heldBanner}>
      <Text style={styles.heldText}>
        🔒 Settlement held until tournament completion
      </Text>
    </View>
  )}
  
  {transaction.releasedAt && (
    <View style={styles.releasedInfo}>
      <Text style={styles.releasedText}>
        🔓 Released on {formatDate(transaction.releasedAt)}
      </Text>
    </View>
  )}
</View>
```

---

### 6. Financial Reports Updates

**Update financial statement generation:**

```javascript
const generateFinancialReport = async (tournamentId) => {
  try {
    const tournament = await getTournament(tournamentId);
    const transactions = await getTransactions(tournamentId);
    
    const report = {
      tournamentName: tournament.name,
      organizerName: tournament.organizerName,
      period: {
        start: tournament.startDate,
        end: tournament.endDate
      },
      collections: {
        totalAmount: tournament.totalCollections,
        playerCount: tournament.paidPlayerCount,
        averagePerPlayer: tournament.totalCollections / tournament.paidPlayerCount
      },
      split: {
        organizerShare: tournament.totalCollections * 0.95,
        platformCommission: tournament.totalCollections * 0.05,
        splitRatio: '95/5'
      },
      settlement: {
        status: tournament.settlementStatus,
        heldAmount: tournament.totalHeldAmount || 0,
        releasedAt: tournament.settlementReleasedAt,
        completedAt: tournament.settlementCompletedAt
      },
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        organizerShare: t.organizerShare,
        platformCommission: t.platformCommission,
        transferStatus: t.transferStatus,
        date: t.createdAt
      }))
    };
    
    return report;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
};
```

---

### 7. Dashboard Widgets

**Add new widgets to owner dashboard:**

```jsx
<View style={styles.dashboardWidgets}>
  {/* Total Held Amount Widget */}
  <View style={styles.widget}>
    <Text style={styles.widgetTitle}>Held Settlements</Text>
    <Text style={styles.widgetValue}>₹{totalHeldAmount}</Text>
    <Text style={styles.widgetSubtext}>
      Across {tournamentsWithHeldSettlements} tournaments
    </Text>
  </View>
  
  {/* Platform Commission Widget */}
  <View style={styles.widget}>
    <Text style={styles.widgetTitle}>Platform Commission</Text>
    <Text style={styles.widgetValue}>₹{totalPlatformCommission}</Text>
    <Text style={styles.widgetSubtext}>
      5% of ₹{totalCollections}
    </Text>
  </View>
  
  {/* Pending Releases Widget */}
  <View style={styles.widget}>
    <Text style={styles.widgetTitle}>Pending Releases</Text>
    <Text style={styles.widgetValue}>{pendingReleasesCount}</Text>
    <Text style={styles.widgetSubtext}>
      Tournaments awaiting settlement release
    </Text>
  </View>
</View>
```

---

### 8. Notifications

**Add notifications for settlement events:**

```javascript
// When settlement is released
const notifySettlementReleased = async (tournamentId, organizerId) => {
  await db.collection('notifications').add({
    userId: organizerId,
    type: 'settlement_released',
    title: 'Settlement Released',
    message: 'Your tournament settlement has been released. Funds will be transferred within 1-2 business days.',
    tournamentId,
    createdAt: new Date(),
    read: false
  });
};

// When settlement is completed
const notifySettlementCompleted = async (tournamentId, organizerId, amount) => {
  await db.collection('notifications').add({
    userId: organizerId,
    type: 'settlement_completed',
    title: 'Settlement Completed',
    message: `₹${amount} has been transferred to your bank account.`,
    tournamentId,
    createdAt: new Date(),
    read: false
  });
};
```

---

## Implementation Checklist

### Owner Dashboard
- [ ] Update tournaments list to show held amount
- [ ] Replace "Process Payout" with "Release Settlement"
- [ ] Add settlement status badges
- [ ] Implement release settlement function
- [ ] Add confirmation dialog for release
- [ ] Show settlement timeline in tournament details
- [ ] Update financial reports to show split details

### Transactions View
- [ ] Display organizer share and platform commission
- [ ] Show transfer status
- [ ] Add held/released indicators
- [ ] Update transaction filters to include settlement status

### Dashboard Widgets
- [ ] Add "Held Settlements" widget
- [ ] Add "Platform Commission" widget
- [ ] Add "Pending Releases" widget
- [ ] Update existing widgets to reflect Route data

### Notifications
- [ ] Implement settlement released notification
- [ ] Implement settlement completed notification
- [ ] Add notification preferences

---

## Testing Checklist

- [ ] Test release settlement flow
- [ ] Verify settlement status updates in real-time
- [ ] Test with multiple tournaments
- [ ] Verify financial reports accuracy
- [ ] Test error handling (failed releases)
- [ ] Test notifications delivery
- [ ] Verify UI responsiveness on mobile

---

## Notes

1. **Automatic vs Manual Release:**
   - Current implementation requires manual release by owner
   - Can be automated based on tournament end date + grace period
   - Add configuration option for auto-release

2. **Bulk Release:**
   - Consider adding bulk release feature for multiple tournaments
   - Useful for monthly settlement cycles

3. **Settlement History:**
   - Add settlement history view
   - Show all past settlements with dates and amounts

4. **Analytics:**
   - Add analytics for settlement patterns
   - Track average time from collection to release
   - Monitor failed transfers

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-24  
**Status:** Implementation Guide
