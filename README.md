# FUTAPI-JS

Fifa Ultimate Team non-official API

# Documentation

Python source provided by: https://github.com/futapi/fut/

# Usage

Login
```
  const FutJS = require('./futapi-js');

  let fut = new FutJS({
    email: 'your@email.com',
    password: 'yourpassword',
    code: '123456',
    platform: 'xbox'
  });

  await fut.login();
```

Once logged in, all methods will be available in `fut` variable.

Usage example:
```
    let filter = {
      level       : 'silver',
      position    : 'RB',
      nationality : 54,
      maxBuy      : 1000,
      startingBid : 1500,
      buyNowPrice : 1600
    };

    let results = await fut.search(filter);
    
    for (let item of results) {
      let bid = await fut.bid(item.tradeId, item.buyNowPrice);
      if (bid) {
        // success
      } else {
        // failed 
      }
    }
```

# Contributing

Open an issue or mail me if you want to contribute.

# Contact

Email: hi@joaopaulo.dev
