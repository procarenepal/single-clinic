# Appointment-Type-Specific Reminders Implementation

This document explains the implementation of Step 4 from the SMS Backend Migration - Appointment-Type-Specific Reminders.

## Overview

The appointment-type-specific reminder system allows clinics to:
- Enable/disable SMS reminders for specific appointment types
- Manage which appointment types receive SMS reminders
- Get statistics on reminder success rates by appointment type
- Bulk update appointment type settings

## Key Features

### 1. Clinic SMS Settings Structure

```javascript
{
  clinicId: "clinic123",
  smsSettings: {
    enabled: true,                          // Global SMS enable/disable
    advanceNoticeHours: 24,                 // Default advance notice
    enabledAppointmentTypes: [              // Specific types enabled for SMS
      "consultation",
      "follow-up", 
      "checkup"
    ],                                      // Empty array = all types enabled
    businessHoursOnly: false,               // Business hours constraint
    businessStartHour: 9,                   // Business day start
    businessEndHour: 17                     // Business day end
  }
}
```

### 2. Appointment Type Filtering Logic

- **Empty `enabledAppointmentTypes` array**: All appointment types receive reminders
- **Populated array**: Only specified appointment types receive reminders  
- **Missing `appointmentType`**: Assumed enabled for backward compatibility
- **Unrecognized appointment type**: Filtered out if not in enabled list

## API Endpoints

### 1. Get Appointment Types for Clinic

Get all appointment types used by a clinic with statistics.

```http
GET /appointment-types/:clinicId?limit=50
X-API-Key: your_api_key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clinicId": "clinic123",
    "enabledAppointmentTypes": ["consultation", "follow-up"],
    "smsEnabled": true,
    "appointmentTypes": [
      {
        "appointmentType": "consultation",
        "count": 45,
        "latestUsed": "2025-08-14T10:00:00Z",
        "sentCount": 40,
        "failedCount": 2,
        "isEnabled": true
      },
      {
        "appointmentType": "surgery",
        "count": 12,
        "latestUsed": "2025-08-13T15:30:00Z",
        "sentCount": 0,
        "failedCount": 0,
        "isEnabled": false
      }
    ]
  }
}
```

### 2. Update Clinic SMS Settings

Update complete SMS settings for a clinic including appointment types.

```http
PUT /clinic-settings/:clinicId
Content-Type: application/json
X-API-Key: your_api_key

{
  "smsSettings": {
    "enabled": true,
    "advanceNoticeHours": 24,
    "enabledAppointmentTypes": ["consultation", "follow-up", "checkup"],
    "businessHoursOnly": false,
    "businessStartHour": 9,
    "businessEndHour": 17
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Clinic SMS settings updated successfully",
  "data": {
    "enabled": true,
    "advanceNoticeHours": 24,
    "enabledAppointmentTypes": ["consultation", "follow-up", "checkup"],
    "businessHoursOnly": false,
    "businessStartHour": 9,
    "businessEndHour": 17
  },
  "upserted": false
}
```

### 3. Bulk Update Appointment Types

Add, remove, or replace appointment types in bulk.

```http
POST /bulk-update-appointment-types/:clinicId
Content-Type: application/json
X-API-Key: your_api_key

{
  "enabledAppointmentTypes": ["surgery", "emergency"],
  "action": "add"
}
```

**Actions:**
- `"add"`: Add types to existing enabled types
- `"remove"`: Remove types from enabled types  
- `"replace"`: Replace all enabled types with provided list

**Response:**
```json
{
  "success": true,
  "message": "Appointment types added successfully",
  "data": {
    "action": "add",
    "requestedTypes": ["surgery", "emergency"],
    "previousEnabledTypes": ["consultation", "follow-up"],
    "newEnabledTypes": ["consultation", "follow-up", "surgery", "emergency"]
  }
}
```

### 4. Enhanced Schedule Reminder

The existing `/schedule-reminder` endpoint now validates appointment types:

```http
POST /schedule-reminder
Content-Type: application/json
X-API-Key: your_api_key

{
  "appointmentId": "apt123",
  "patientPhone": "+1234567890",
  "doctorName": "Dr. Smith",
  "appointmentTime": "2025-08-15T15:00:00Z",
  "clinicName": "Health Clinic",
  "appointmentType": "surgery",
  "clinicId": "clinic123"
}
```

**Response if appointment type not enabled:**
```json
{
  "success": false,
  "error": "SMS reminders are not enabled for appointment type: surgery",
  "enabledTypes": ["consultation", "follow-up", "checkup"]
}
```

## Implementation Details

### 1. Appointment Type Validation Function

```javascript
function isAppointmentTypeEnabled(appointmentType, clinicSettings) {
  // If no specific types configured, all types enabled
  if (!clinicSettings.enabledAppointmentTypes || 
      clinicSettings.enabledAppointmentTypes.length === 0) {
    return {
      enabled: true,
      reason: 'All appointment types enabled (no specific filtering)'
    };
  }
  
  // If appointment type not provided, assume enabled
  if (!appointmentType) {
    return {
      enabled: true,
      reason: 'Appointment type not specified, assuming enabled'
    };
  }
  
  // Check if type is in enabled list
  const isEnabled = clinicSettings.enabledAppointmentTypes.includes(appointmentType);
  
  return {
    enabled: isEnabled,
    reason: isEnabled 
      ? `Appointment type "${appointmentType}" is enabled for SMS reminders`
      : `Appointment type "${appointmentType}" is not enabled. Enabled types: ${clinicSettings.enabledAppointmentTypes.join(', ')}`
  };
}
```

### 2. Enhanced Cron Job Processing

The cron job now checks appointment types before processing:

```javascript
// Check if appointment type is enabled for reminders
const appointmentTypeCheck = isAppointmentTypeEnabled(
  reminder.appointmentType, 
  clinicSettings
);

if (!appointmentTypeCheck.enabled) {
  await db.collection('scheduled_reminders').updateOne(
    { _id: reminder._id },
    { 
      $set: { 
        status: 'skipped',
        reason: appointmentTypeCheck.reason,
        processedAt: now
      }
    }
  );
  console.log(`Skipped reminder for appointment ${reminder.appointmentId} - ${appointmentTypeCheck.reason}`);
  continue;
}
```

### 3. Database Collections

#### Clinics Collection
```javascript
{
  _id: ObjectId,
  clinicId: "clinic123",
  smsSettings: {
    enabled: true,
    advanceNoticeHours: 24,
    enabledAppointmentTypes: ["consultation", "follow-up"],
    businessHoursOnly: false,
    businessStartHour: 9,
    businessEndHour: 17
  },
  updatedAt: Date
}
```

#### Enhanced Scheduled Reminders Collection
```javascript
{
  _id: ObjectId,
  appointmentId: "apt123",
  appointmentType: "consultation",
  clinicId: "clinic123",
  status: "scheduled|sent|failed|skipped",
  reason: "Appointment type not enabled", // For skipped items
  // ... other fields
}
```

## Usage Scenarios

### Scenario 1: Enable SMS for Consultations Only

```bash
curl -X PUT https://your-backend-server.com/clinic-settings/clinic123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_key" \
  -d '{
    "smsSettings": {
      "enabled": true,
      "enabledAppointmentTypes": ["consultation"]
    }
  }'
```

### Scenario 2: Add Emergency Appointments to Enabled Types

```bash
curl -X POST https://your-backend-server.com/bulk-update-appointment-types/clinic123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_key" \
  -d '{
    "enabledAppointmentTypes": ["emergency"],
    "action": "add"
  }'
```

### Scenario 3: Get Statistics for All Appointment Types

```bash
curl -X GET https://your-backend-server.com/appointment-types/clinic123 \
  -H "X-API-Key: your_key"
```

### Scenario 4: Remove Surgery from SMS Reminders

```bash
curl -X POST https://your-backend-server.com/bulk-update-appointment-types/clinic123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_key" \
  -d '{
    "enabledAppointmentTypes": ["surgery"],
    "action": "remove"
  }'
```

## Testing

### Test Appointment Type Filtering

1. **Set up clinic with specific appointment types:**
   ```javascript
   // Only enable "consultation" and "follow-up"
   PUT /clinic-settings/testclinic
   {
     "smsSettings": {
       "enabledAppointmentTypes": ["consultation", "follow-up"]
     }
   }
   ```

2. **Test scheduling different appointment types:**
   ```javascript
   // Should succeed
   POST /schedule-reminder
   { "appointmentType": "consultation", "clinicId": "testclinic" }
   
   // Should fail
   POST /schedule-reminder  
   { "appointmentType": "surgery", "clinicId": "testclinic" }
   ```

3. **Verify cron job skips inappropriate types:**
   - Schedule reminders for various appointment types
   - Run cron job manually
   - Check that only enabled types are processed

### Monitoring & Debugging

**Log Messages to Watch:**
- `✅ Updated SMS settings for clinic clinic123`
- `✅ Bulk updated appointment types for clinic clinic123`
- `Skipped reminder for appointment apt123 - Appointment type "surgery" is not enabled`

**Common Issues:**
1. **All appointments skipped**: Check if `enabledAppointmentTypes` is too restrictive
2. **Wrong appointment types enabled**: Use bulk update to fix quickly
3. **No appointment type in request**: Will be assumed enabled for backward compatibility

## Performance Considerations

- Appointment type checking is done in-memory after fetching clinic settings
- Database queries are optimized for clinic-specific filtering
- Statistics aggregation uses MongoDB aggregation pipeline for efficiency
- Bulk updates use single database operations

---

**Status: Step 4 - Appointment-Type-Specific Reminders is COMPLETE ✅**

The implementation provides comprehensive appointment type management with:
- ✅ Clinic-specific appointment type filtering
- ✅ Bulk management operations  
- ✅ Statistics and reporting
- ✅ Enhanced cron job processing
- ✅ Backward compatibility
- ✅ Complete API documentation
