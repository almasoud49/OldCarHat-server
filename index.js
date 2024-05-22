const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
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
    const carCollection = database.collection('cars');
    const userCollection = database.collection('users');
    const categoryCollection = database.collection('categories');
    const orderCollection = database.collection('orders');
    const blogCollection = database.collection('blogs');
    const paymentCollection = database.collection('payments');
   


  } finally {
    
    // await client.close();
  }
}
oldCarHat().catch(console.dir);

app.listen(port, () => {
  console.log(`OldCarHat app listening on port ${port}`)
})