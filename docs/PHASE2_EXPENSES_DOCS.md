# Phase 2: Staff Expense Management

## Overview

Complete staff expense management system with approval workflow, reimbursement tracking, and analytics.

---

## Features

✅ **Expense Claims**: Staff can submit expense claims with receipts
✅ **Approval Workflow**: Managers approve/reject expenses
✅ **Reimbursement Tracking**: Track reimbursements with payment methods
✅ **Receipt Upload**: Upload receipt images to S3
✅ **Analytics**: Expense breakdown by category and staff
✅ **Multi-Category**: FUEL, UTILITIES, SUPPLIES, TRANSPORT, MEALS, OTHER

---

## GraphQL API

### 1. Create Staff Expense

```graphql
mutation CreateStaffExpense($receipt: Upload) {
  createStaffExpense(input: {
    category: FUEL
    amountPesewas: 15000  # GH₵150.00
    description: "Fuel for delivery van - April 10"
    merchantName: "Shell Petrol Station"
    expenseDate: "2026-04-10"
    receiptImage: $receipt
    paymentMethod: CASH
  }) {
    id
    amountFormatted
    status  # PENDING
    createdByName
    createdAt
  }
}
```

### 2. Get Staff Expenses

```graphql
query GetStaffExpenses {
  staffExpenses(
    status: PENDING
    startDate: "2026-04-01"
    endDate: "2026-04-30"
  ) {
    id
    category
    amountFormatted
    description
    merchantName
    expenseDate
    receiptUrl
    status
    createdByName
    approvedByName
    approvedAt
  }
}
```

### 3. Approve/Reject Expense

```graphql
mutation ApproveStaffExpense {
  approveStaffExpense(input: {
    expenseId: "expense-uuid"
    approve: true  # false to reject
    notes: "Approved - valid receipt"
    reimbursementMethod: MOMO
  }) {
    id
    status  # APPROVED or REJECTED
    approvedByName
    approvedAt
    approvalNotes
  }
}
```

### 4. Reimburse Expense

```graphql
mutation ReimburseStaffExpense {
  reimburseStaffExpense(input: {
    expenseId: "expense-uuid"
    reimbursementMethod: MOMO
    reference: "MOMO-TXN-789"
  }) {
    id
    status  # REIMBURSED
    reimbursementMethod
    reimbursedByName
    reimbursedAt
    reimbursementReference
  }
}
```

### 5. Expense Analytics

```graphql
query ExpenseAnalytics {
  expenseAnalytics(
    startDate: "2026-04-01"
    endDate: "2026-04-30"
  ) {
    totalExpensesFormatted
    
    byCategory {
      category
      amountFormatted
      count
      percentOfTotal
    }
    
    byStaff {
      staffName
      amountFormatted
      count
    }
    
    pendingApprovalCount
    pendingReimbursementFormatted
  }
}
```

---

## Workflow

```
1. Staff submits expense
   ↓
2. Manager reviews
   ↓
3. Manager approves/rejects
   ↓
4. If approved → Manager reimburses
   ↓
5. Status: REIMBURSED
```

---

## Status Flow

```
PENDING → APPROVED → REIMBURSED
        ↘ REJECTED
```

---

## Categories

- **FUEL**: Vehicle fuel expenses
- **UTILITIES**: Electricity, water, internet
- **SUPPLIES**: Office supplies, cleaning materials
- **TRANSPORT**: Transportation costs
- **MEALS**: Staff meals during work
- **OTHER**: Miscellaneous expenses

---

## Payment Methods

**Expense Payment**:
- CASH
- MOMO
- PERSONAL_CARD

**Reimbursement**:
- CASH
- MOMO
- BANK_TRANSFER

---

## Permissions

| Action | Roles |
|--------|-------|
| Create Expense | All staff |
| View Expenses | All staff (own) / Managers (all) |
| Approve/Reject | Manager, Owner |
| Reimburse | Manager, Owner |
| Analytics | Manager, Owner |

---

**Status**: ✅ READY FOR USE
**API**: LIVE on http://localhost:4000/graphql
