const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express()


const port = process.env.PORT || 5000;

//Middleware
app.use(cors());
app.use(express.json());




app.get('/', (req, res) => {
  res.send('Welcome Everyone to OldCarHat!')
});



//MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@personal.dp2qomu.mongodb.net/?retryWrites=true&w=majority&appName=personal`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
 const oldCarHat  =async()=> {
  try {

    const database = client.db('oldCarHat');
    const productCollection = database.collection('products');
    const userCollection = database.collection('users');
    const categoryCollection = database.collection('categories');
    const orderCollection = database.collection('orders');
    const blogCollection = database.collection('blogs');
    const paymentCollection = database.collection('payments');
   


   
   //Products related API
   app.get('/products' , async(req, res)=>{
    const query = {};
    const result = await productCollection
    .find(query)
    .sort({createdAt: -1})
    .toArray();
    res.send(result);
   });

   app.post('/products', async(req,res)=>{
    const product = req.body;
    const result = await productCollection.insertOne(product);
    res.send(result);
   });

   //Get all reported seller product
   app.get('/reported-products' ,async(req, res)=>{
    const query = {reported: true};
    const result = await productCollection
    .find(query)
    .sort({reportCount: 1})
    .toArray();
    res.send(result);
  });


   app.patch('/report-product/:id' , async(req,res)=>{
    const id = req.query.id;
    const prevReport = parseInt(req.query.reportCount);
    const filter = {_id: new ObjectId(id)};
    const option = {upsert: true};
    const updatedDoc = {
      $set: {
        reported: true,
        reportedCount: prevReport + 1
      }
    };

    const result = await productCollection.updateOne(filter, updatedDoc,option);
    res.send(result);
  });
   
  //Delete a product created by seller (delete by seller)
   app.delete('/product-delete/:id', async(req,res)=>{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)};
    const result = await productCollection.deleteOne(filter);
    res.send(result);

   });
   
   //Undo report given by buyer(Admin Only)
   app.patch('/report-product-safe/:id', async(req,res)=>{
    const id = req.query.id;
    const filter = {_id: new ObjectId(id)};
    const option = {upsert: true};
    const updatedDoc = {
      $set : {
        reported:false
      }
    };
    const result = await productCollection.updateOne(
      filter, updatedDoc,option
    )
    res.send(result)
   });

   //Delete Reported product by admin
   app.delete('/report-product-delete/:id', async(req, res)=>{
    const id = req.query.id;
    const filter = {_id: new ObjectId(id)};
    const result = await productCollection.deleteOne(filter);
    res.send(result);
   });
   
    //Category Related API
    app.get('/categories' , async(req, res)=>{
      const query = {};
      const categories = await categoryCollection
      .find(query)
      .sort({category_name:1})
      .toArray();
      res.send(categories);
    });

    app.post('/categories', async(req,res)=>{
      // const uid = req.params.uid;
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      res.send(result);

    });


    //User Related API//

    //Saved new user data on database
    app.post('/users', async(req, res)=>{
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //Check user is Admin
    app.get('/user/admin/:id' , async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const user = await userCollection.findOne(query);
      res.send({isAdmin: user?.role === 'admin' ? true : false})

    });

       

    app.get('/user/buyer/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const user = await userCollection.findOne(query);
      res.send({isBuyer: user?.role === 'buyer' ? true : false});
    });

    //Get all user data filter by their role
    app.get('/users-by-role' , async(req, res)=>{
      const role = req.query.role;
      const query = {role};
      const users = await userCollection.find(query).toArray();
      res.send(users);
    })

    
    // make seller verified
    app.patch('/seller-verify/:id', async(req, res)=>{
      const id = req.query.id;
      const filter = {_id: new ObjectId(id)};
      const option = {upsert: true};
      const updatedDoc = {
        $set: {
          status:'verified'
        }
      };

      const result = await userCollection.updateOne(filter,updatedDoc, option);
      res.send(result);

    });

    //Checked user is Seller
    app.get('/user/seller/:id' , async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const user = await userCollection.findOne(query);
      res.send({isSeller: user?.role === 'seller' ? true: false});

    });

    //Delete user by admin
    app.delete('/user-delete/:id', async(req,res)=>{
      const id = req.query.id;
      const filter = { _id: new ObjectId(id)};
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });



    //order related API//
    app.get('/orders', async(req, res)=>{
      const orders = await orderCollection.find().toArray();
      res.send(orders);
    });



    app.get('/orders/:id' , async(req, res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const order = await orderCollection.findOne(query);
      res.send(order);
    });

    //Create a order by user
    app.post('/orders', async(req,res)=>{
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
      const productQuery = {
        _id: new ObjectId(order.product_info?.product_id)
      };
      const option = {upsert: true};
      const orderedProduct = await productCollection.findOne(productQuery)

    });

    //Promote related API//

    //Get All Promoted Product
    app.get('/promoted-product', async(req, res)=>{
      const query = {promote: true};
      const products = await productCollection
      .find(query)
      .sort({createAt: -1})
      .toArray();
      res.send(products);
    });

    // Make a product to promoted product
    app.patch('/promote-product', async(req, res)=>{
      const id = req.query.id;
      const filter = {_id: new ObjectId(id)};
      const option = {upsert: true};
      const updatedDoc = {
        $set: {
          promote: true
        }
      };
      const result = await productCollection.updateOne(
        filter, 
        updatedDoc, 
        option
      );
      res.send(result);
    });

//Blog Related API//
app.get('/blogs', async(req, res)=>{
  const query = {};
  const blogs = await blogCollection.find(query).toArray();
  res.send(blogs)
});


app.post('/blog', async(req, res)=>{
  const blog = req.body;
  const result = await blogCollection.insertOne(blog);
  res.send(result);
});



//Payment Related API//
  } finally {
    
    // await client.close();
  }
}
oldCarHat().catch(console.dir);

app.listen(port, () => {
  console.log(`OldCarHat app listening on port ${port}`)
})