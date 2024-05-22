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
   })

   app.post('/products', async(req,res)=>{
    const product = req.body;
    const result = await productCollection.insertOne(product);
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

    //User Related API
    app.post('/users', async(req, res)=>{
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/user/admin/:id' , async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const user = await userCollection.findOne(query);
      res.send({isAdmin: user?.role === 'admin' ? true : false})

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

    app.get('/user/buyer/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const user = await userCollection.findOne(query);
      res.send({isBuyer: user?.role === 'buyer' ? true : false});
    });

    //Report a seller created product by buyer, only buyer can report

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
    })

  } finally {
    
    // await client.close();
  }
}
oldCarHat().catch(console.dir);

app.listen(port, () => {
  console.log(`OldCarHat app listening on port ${port}`)
})