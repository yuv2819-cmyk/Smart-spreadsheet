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
            {"Product Name": "MacBook Pro M3", "Category": "Electronics", "Price": 1999, "Units": 45, "Revenue": 89955, "Stock Status": "In Stock", "Priority": "High"},
            {"Product Name": "Ergonomic Chair", "Category": "Furniture", "Price": 850, "Units": 32, "Revenue": 27200, "Stock Status": "In Stock", "Priority": "Medium"},
            {"Product Name": "Dell XPS 15", "Category": "Electronics", "Price": 2100, "Units": 18, "Revenue": 37800, "Stock Status": "Low Stock", "Priority": "High"},
            {"Product Name": "Wool Sweater", "Category": "Clothing", "Price": 120, "Units": 156, "Revenue": 18720, "Stock Status": "In Stock", "Priority": "Low"},
            {"Product Name": "Smart Lamp", "Category": "Home", "Price": 60, "Units": 200, "Revenue": 12000, "Stock Status": "In Stock", "Priority": "Low"},
            {"Product Name": "Sony XM5", "Category": "Electronics", "Price": 350, "Units": 89, "Revenue": 31150, "Stock Status": "Out of Stock", "Priority": "Medium"},
            {"Product Name": "Desk Mat", "Category": "Accessories", "Price": 25, "Units": 500, "Revenue": 12500, "Stock Status": "In Stock", "Priority": "Low"},
            {"Product Name": "Mechanical Keyb", "Category": "Electronics", "Price": 180, "Units": 45, "Revenue": 8100, "Stock Status": "In Stock", "Priority": "High"},
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
