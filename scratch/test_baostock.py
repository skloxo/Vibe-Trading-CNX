import baostock as bs
import pandas as pd

print("Connecting to BaoStock...")
lg = bs.login()
print(f"Login error_code: {lg.error_code}")
print(f"Login error_msg: {lg.error_msg}")

if lg.error_code == '0':
    print("Successfully connected. Querying daily bars for sh.600000...")
    rs = bs.query_history_k_data_plus(
        "sh.600000",
        "date,code,open,high,low,close,volume",
        start_date="2026-06-01",
        end_date="2026-06-15",
        frequency="d",
        adjustflag="3"
    )
    print(f"Query error_code: {rs.error_code}")
    
    data_list = []
    while (rs.error_code == '0') & rs.next():
        data_list.append(rs.get_row_data())
    
    if data_list:
        df = pd.DataFrame(data_list, columns=rs.fields)
        print("\n--- Sample Data ---")
        print(df.head(3))
        print("-------------------")
        print("BaoStock status: OK (data fetched successfully)")
    else:
        print("Query returned empty dataset, check if dates are trading days.")
        
    bs.logout()
else:
    print("BaoStock login failed. Status: ERROR")
