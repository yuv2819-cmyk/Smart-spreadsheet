import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models import Dataset, DataRow
from app.database import DATABASE_URL
import json

async def seed_data():
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # Check if dataset exists
        # We know tenant_id=1, user_id=1 from init_db
        
        dataset = Dataset(
            tenant_id=1,
            user_id=1,
            name="Q1 Sales Data",
            description="Sales data for Q1 2024",
            source_type="csv",
            schema_info={"Product Name": "object", "Category": "object", "Price": "int64", "Units": "int64", "Revenue": "int64", "Stock Status": "object", "Priority": "object"},
            row_count=8
        )
        session.add(dataset)
        await session.commit()
        await session.refresh(dataset)
        
        print(f"Created dataset: {dataset.name} (ID: {dataset.id})")
        
        # Add rows
        rows_data = [
            {"col0": "MacBook Pro M3", "col1": "Electronics", "col2": 1999, "col3": 45, "col4": 89955, "col5": "In Stock", "col6": "Active", "col7": "High"},
            {"col0": "Ergonomic Chair", "col1": "Furniture", "col2": 850, "col3": 32, "col4": 27200, "col5": "In Stock", "col6": "Review", "col7": "Medium"},
            {"col0": "Dell XPS 15", "col1": "Electronics", "col2": 2100, "col3": 18, "col4": 37800, "col5": "Low Stock", "col6": "Active", "col7": "High"},
            {"col0": "Wool Sweater", "col1": "Clothing", "col2": 120, "col3": 156, "col4": 18720, "col5": "In Stock", "col6": "Draft", "col7": "Low"},
            {"col0": "Smart Lamp", "col1": "Home", "col2": 60, "col3": 200, "col4": 12000, "col5": "In Stock", "col6": "Active", "col7": "Low"},
            {"col0": "Sony XM5", "col1": "Electronics", "col2": 350, "col3": 89, "col4": 31150, "col5": "Out of Stock", "col6": "Inactive", "col7": "Medium"},
            {"col0": "Desk Mat", "col1": "Accessories", "col2": 25, "col3": 500, "col4": 12500, "col5": "In Stock", "col6": "Active", "col7": "Low"},
            {"col0": "Mechanical Keyb", "col1": "Electronics", "col2": 180, "col3": 45, "col4": 8100, "col5": "In Stock", "col6": "Active", "col7": "High"},
        ]
        
        for i, row in enumerate(rows_data):
            row_with_id = {"id": i, **row}
            db_row = DataRow(
                tenant_id=1,
                dataset_id=dataset.id,
                row_data=row_with_id
            )
            session.add(db_row)
        
        await session.commit()
        print(f"Seeded {len(rows_data)} rows.")

if __name__ == "__main__":
    asyncio.run(seed_data())
