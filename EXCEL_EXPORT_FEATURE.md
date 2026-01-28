# Excel Export Feature - Player Registrations

## ✅ Feature Implemented

Added Excel/CSV export functionality for tournament player registrations with comprehensive player data.

---

## 📊 Exported Fields

The Excel export includes the following columns in order:

| # | Column Name | Description |
|---|-------------|-------------|
| 1 | Registration No | Sequential number (1, 2, 3...) |
| 2 | Paid | YES/NO payment status |
| 3 | Player Name | Full name of the player |
| 4 | Email | Player's email address |
| 5 | Phone | Contact number |
| 6 | Age | Player's age |
| 7 | DOB | Date of Birth |
| 8 | Gender | Male/Female/Other |
| 9 | Blood Group | Blood group |
| 10 | Address | Full address (quoted for CSV) |
| 11 | Aadhar No | Aadhar card number |
| 12 | Emergency Contact | Emergency phone number |
| 13 | Jersey Name | Custom jersey name |
| 14 | Jersey Number | Jersey number |
| 15 | T-Shirt Size | T-shirt size |
| 16 | Short Size | Shorts size |
| 17 | Photo URL | Link to player photo |
| 18 | Aadhar Photo URL | Link to Aadhar card photo |
| 19 | Registered Date | Registration timestamp |
| 20 | Payment ID | Razorpay payment ID |
| 21 | Amount Paid | Payment amount in ₹ |

---

## 🎯 How to Use

### For Tournament Owners:

1. **Navigate to Tournaments Screen**
   - Go to Owner Dashboard → Tournaments

2. **Find Your Tournament**
   - Scroll to the tournament you want to export

3. **Click "Export Players" Button**
   - Green button with Excel icon
   - Located between "Edit Tournament" and "Delete" buttons

4. **File Download**
   - **Web:** File downloads automatically as CSV
   - **Mobile:** Share dialog opens to save/share the file

---

## 📁 File Format

**Filename Pattern:**
```
{TournamentName}_Players_{Date}.csv
```

**Example:**
```
Chess_Solo_Players_2026-01-20.csv
```

**Format:** CSV (Comma-Separated Values)
- Opens in Microsoft Excel
- Opens in Google Sheets
- Opens in any spreadsheet application

---

## 🔧 Technical Implementation

### Files Created/Modified:

1. **`src/services/ExcelExportService.js`** (NEW)
   - Export logic
   - CSV generation
   - File download/sharing

2. **`app/(owner)/tournaments.js`** (MODIFIED)
   - Added "Export Players" button
   - Added export handler function
   - Imported ExcelExportService

---

## 💡 Features

### ✅ Comprehensive Data
- All player personal details
- Payment information
- Kit/Jersey details
- Photo URLs for reference

### ✅ Cross-Platform
- **Web:** Direct download
- **Mobile:** Share via any app

### ✅ Secure
- Only tournament owners can export
- No sensitive data exposure (Aadhar partially masked in UI, full in export)

### ✅ Sorted Data
- Players sorted by registration date (newest first)
- Sequential registration numbers

---

## 📝 Sample Export

```csv
Registration No,Paid,Player Name,Email,Phone,Age,DOB,Gender,Blood Group,Address,Aadhar No,Emergency Contact,Jersey Name,Jersey Number,T-Shirt Size,Short Size,Photo URL,Aadhar Photo URL,Registered Date,Payment ID,Amount Paid
1,YES,Ritik Yadav,ritik@example.com,9876543210,25,10-08-1998,Male,O+,"123 Main St, City",123456789012,9876543211,RITIK,10,L,M,https://...,https://...,20/01/2026 12:09 PM,pay_XXXXXX,10
2,NO,John Doe,john@example.com,9876543211,22,15-05-2001,Male,A+,"456 Park Ave, City",987654321098,9876543212,JOHN,7,M,M,https://...,https://...,20/01/2026 11:30 AM,,0
```

---

## 🎨 UI Changes

### Tournament Card - New Button

**Before:**
```
[Edit Tournament] [Delete]
```

**After:**
```
[Edit Tournament] [Export Players] [Delete]
```

**Button Style:**
- Icon: Microsoft Excel logo
- Color: Green (#217346)
- Style: Outlined
- Position: Between Edit and Delete

---

## 🔐 Security & Privacy

### Data Handling:
- ✅ Export only accessible to tournament owners
- ✅ No data sent to external servers
- ✅ File generated locally on device
- ✅ Aadhar numbers included (for official records)

### Photo URLs:
- URLs point to Firebase Storage
- Access controlled by Firebase Security Rules
- Photos remain private and secure

---

## 📱 Platform-Specific Behavior

### Web Browser:
1. Click "Export Players"
2. File downloads to Downloads folder
3. Success alert shown
4. Open with Excel/Sheets

### Mobile (Android/iOS):
1. Tap "Export Players"
2. Share dialog appears
3. Choose app (Email, Drive, WhatsApp, etc.)
4. File shared/saved

---

## 🐛 Troubleshooting

### "No Data" Alert
- **Cause:** Tournament has no registered players
- **Solution:** Wait for players to register

### Export Button Not Working
- **Cause:** Missing dependencies
- **Solution:** Run `npm install` to ensure all packages are installed

### File Not Opening in Excel
- **Cause:** CSV encoding issue
- **Solution:** 
  1. Open Excel
  2. File → Import → CSV
  3. Select UTF-8 encoding

---

## 🚀 Future Enhancements

Potential improvements:
- [ ] Filter by payment status (paid/unpaid)
- [ ] Export to PDF format
- [ ] Include team information
- [ ] Add tournament statistics
- [ ] Bulk email to players
- [ ] QR code generation for each player

---

## ✅ Testing Checklist

- [x] Export service created
- [x] Button added to UI
- [x] Import statements added
- [x] Handler function implemented
- [ ] Test export with players
- [ ] Verify all fields populated
- [ ] Test on web browser
- [ ] Test on mobile device
- [ ] Verify CSV opens in Excel

---

**Feature Status:** ✅ **READY FOR TESTING**

All code has been implemented. Test by:
1. Creating a tournament
2. Registering some players
3. Clicking "Export Players" button
4. Verifying the downloaded CSV file

---

**Created:** January 20, 2026  
**Version:** 1.0.0  
**Dependencies:** expo-file-system, expo-sharing (already installed)
