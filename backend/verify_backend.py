from datetime import datetime, timedelta
from app import app, db
from models import Task, Expense

def run_tests():
    print("--- Starting Backend Logic Verifications ---")
    # Setup temporary database in memory for verification (avoid wiping actual tracker.db)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.drop_all()
        db.create_all()

        print("\nTest Case 1: Task Creation with No Estimated Date")
        # Task validation test: None date
        t1 = Task(
            title="Task without End Date",
            estimated_end_date=None,
            workspace_id=1,
            created_by=1
        )
        valid, msg = t1.validate()
        print(f"Result: valid={valid}, message='{msg}'")
        assert not valid, "Failed: Task allowed without estimated end date"
        print("Success: Task properly rejected missing estimated end date.")

        print("\nTest Case 2: Task Creation with Past Estimated Date")
        # Task validation test: past date
        past_time = datetime.utcnow() - timedelta(hours=2)
        t2 = Task(
            title="Task with Past Date",
            estimated_end_date=past_time,
            workspace_id=1,
            created_by=1,
            created_at=datetime.utcnow()
        )
        valid, msg = t2.validate()
        print(f"Result: valid={valid}, message='{msg}'")
        assert not valid, "Failed: Task allowed with past estimated end date"
        print("Success: Task properly rejected past estimated end date.")

        print("\nTest Case 3: Task Creation with Valid Future Date")
        # Task validation test: valid future date
        future_time = datetime.utcnow() + timedelta(days=2)
        t3 = Task(
            title="Valid Task",
            estimated_end_date=future_time,
            workspace_id=1,
            created_by=1,
            created_at=datetime.utcnow()
        )
        valid, msg = t3.validate()
        print(f"Result: valid={valid}, message='{msg}'")
        assert valid, f"Failed: Valid task rejected: {msg}"
        print("Success: Valid task configuration accepted.")

        print("\nTest Case 4: Expense with Negative Amount")
        # Expense validation: negative amount
        e1 = Expense(
            amount=-50.0,
            category="Meals",
            date=datetime.utcnow(),
            workspace_id=1,
            user_id=1
        )
        valid, msg = e1.validate()
        print(f"Result: valid={valid}, message='{msg}'")
        assert not valid, "Failed: Expense allowed with negative amount"
        print("Success: Expense properly rejected negative amount.")

        print("\nTest Case 5: Expense with Future Date")
        # Expense validation: future date
        future_expense_date = datetime.utcnow() + timedelta(days=1)
        e2 = Expense(
            amount=120.50,
            category="Travel",
            date=future_expense_date,
            workspace_id=1,
            user_id=1
        )
        valid, msg = e2.validate()
        print(f"Result: valid={valid}, message='{msg}'")
        assert not valid, "Failed: Expense allowed with future date"
        print("Success: Expense properly rejected future date.")

        print("\nTest Case 6: Valid Expense Logging")
        # Expense validation: valid
        e3 = Expense(
            amount=85.00,
            category="Software",
            date=datetime.utcnow() - timedelta(hours=1),
            workspace_id=1,
            user_id=1
        )
        valid, msg = e3.validate()
        print(f"Result: valid={valid}, message='{msg}'")
        assert valid, f"Failed: Valid expense rejected: {msg}"
        print("Success: Valid expense parameters accepted.")
        
        print("\n--- All Backend Logic Verifications Passed! ---")

if __name__ == '__main__':
    run_tests()
