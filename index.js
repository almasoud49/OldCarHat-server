const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

//mongoDB
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
    //database name
    const database = client.db('oldCarHat');
    //database collection
    const productCollection = database.collection('products');
    const userCollection = database.collection('users');
    const categoryCollection = database.collection('categories');
    const orderCollection = database.collection('orders');
    const blogCollection = database.collection('blogs');
    const paymentCollection = database.collection('payments');
   
    
    // middlewares//
    //Verify JWT Token 
    const verifyToken = (req, res, next) =>{
      const authHeader = req.headers.authorization;
      if(!authHeader){
        return res.status(401).send({message:"Unauthorized Access"});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (err, decoded)=>{
        if(err){
          return res.status(401).send({message:"Unauthorized Access"})
          }
          req.decoded= decoded;
          next();
      })
    }

    //Verify User role is Seller
    const verifySeller = async(req,res, next)=>{
      const decoded = req.decoded;
      const sellerQuery = {uid: decoded.uid};
      const seller = await userCollection.findOne(sellerQuery);
      if(!seller && seller.role !== 'seller'){
        return res.status(403).send({message:'Access Forbidden'})

      }
      next();
    };

    //Verify user role is Admin
    const verifyAdmin = async(req,res,next)=>{
      const decoded = req.decoded;
      const adminQuery = {uid: decoded.uid};
      const admin = await userCollection.findOne(adminQuery);
      if(!admin && admin.role !== 'admin'){
        return res.status(403).send({message:'Access Forbidden'})
      }
      next();
    }
    
    //JWT Token
    app.post('/jwt', async(req, res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_ACCESS_TOKEN,{expiresIn:process.env.JWT_SECRET_EXPIRESIN});
      res.send({token})
    });

   

   //products related API//
   //get all product created by seller
   app.get('/products/:uid' ,verifyToken, verifySeller, async(req, res)=>{
    const decoded = req.decoded;
			const uid = req.params.uid;
			const query = { seller_uid: uid };
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden'});
			}
    const result = await productCollection
    .find(query)
    .sort({ createAt: -1 })
    .toArray();
    res.send(result);
   });

   //get all product filter by category id
   app.get('/category/:id', async(req,res)=>{
    const id = req.params.id;
			 
			const filterById = {_id: new ObjectId(id)}
      const query = { category_id: filterById };
			const result = await productCollection
				.find(query)
				.sort({ createAt: -1 })
				.toArray();
			res.send(result);
   });

//post only seller created product
   app.post('/products/:uid',verifyToken,
   verifySeller, async(req,res)=>{
    const decoded = req.decoded;
				const uid = req.params.uid;
    const product = req.body;
    if (uid !== decoded.uid) {
      return res
        .status(403)
        .send({ message: 'Access Forbidden'});
    }
    const result = await productCollection.insertOne(product);
    res.send(result);
   });

   //get all reported seller product
   app.get('/reported-products/:uid' , verifyToken,verifyAdmin ,async(req, res)=>{
    const decoded = req.decoded;
				const uid = req.params.uid;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden'});
				}
    const query = {reported: true};
    const result = await productCollection
    .find(query)
    .sort({reportCount: 1})
    .toArray();
    res.send(result);
  });

  //report a seller created product by buyer, only buyer can report
   app.patch('/report-product/:uid' ,verifyToken, async(req,res)=>{
    const decoded = req.decoded;
			const uid = req.params.uid;
    const id = req.query.id;
    const prevReport = parseInt(req.query.reportCount);
    if (uid !== decoded.uid) {
      return res
        .status(403)
        .send({ message: 'Access Forbidden'});
    }
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
   
  //delete a product created by seller (delete by seller)
   app.delete('/product-delete/:uid',verifyToken,verifySeller, async(req,res)=>{
    const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden'});
				}
    const filter = {_id: new ObjectId(id)};
    const result = await productCollection.deleteOne(filter);
    res.send(result);

   });
   
   //undo report given by buyer(Admin Only)
   app.patch('/report-product-safe/:uid',verifyToken,verifyAdmin, async(req,res)=>{
    const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden'});
				}
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

   //delete Reported product by admin
   app.delete('/report-product-delete/:uid', verifyToken,verifyAdmin, async(req, res)=>{
    const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden'});
				}
    const filter = {_id: new ObjectId(id)};
    const result = await productCollection.deleteOne(filter);
    res.send(result);
   });
   
    //Category Related API//
   
    //get all category list
		app.get('/categories', async (req, res) => {
			const query = {};
			const categories = await categoryCollection
				.find(query)
				.sort({ category_name: 1 })
				.toArray();
			res.send(categories);
		});

    //create a category items by Seller
    app.post('/categories/:uid',verifyToken,verifySeller, async(req,res)=>{
      const decoded = req.decoded;
      const uid = req.params.uid;
      const new_category = req.body;
      if (uid !== decoded.uid) {
        return res
          .status(403)
          .send({ message: 'Access Forbidden'});
      }
      const result = await categoryCollection.insertOne(new_category);
      res.send(result);

    });


    //User Related API//

    //saved new user data on database
    app.post('/users', async(req, res)=>{
      const user = req.body;
      const query = { uid: user.uid };
			const userInDb = await userCollection.findOne(query);
			if (userInDb?.uid) {
				return res.send({});
			}

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //check user is Admin
    app.get('/user/admin/:uid' , async(req,res)=>{
      const uid = req.params.uid;
			const query = { uid };
      const user = await userCollection.findOne(query);
      res.send({isAdmin: user?.role === 'admin' ? true : false})

    });

       
    //check is user is buyer
    app.get('/user/buyer/:uid', async(req,res)=>{
      const uid = req.params.uid;
			const query = { uid: uid };
      const user = await userCollection.findOne(query);
      res.send({isBuyer: user?.role === 'buyer' ? true : false});
    });

    //get all user data filter by their role
    app.get('/users-by-role/:uid' ,verifyToken,verifyAdmin, async(req, res)=>{
      const decoded = req.decoded;
				const uid = req.params.uid;
				const role = req.query.role;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden'});
				}
      const query = {role};
      const users = await userCollection.find(query).toArray();
      res.send(users);
    })

    
    // make seller verified
    app.patch('/seller-verify/:uid',verifyToken,verifyAdmin, async(req, res)=>{
      const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden'});
				}
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

    //checked user is Seller
    app.get('/user/seller/:uid' , async(req, res)=>{
      const uid = req.params.uid;
			const query = { uid: uid };
      const user = await userCollection.findOne(query);
      res.send({isSeller: user?.role === 'seller' ? true: false});

    });

    //checked Seller Verified
    app.get('/seller-verify/:uid', async(req,res)=>{
      const uid = req.params.uid;
			const query = { uid: uid };
			const seller = await userCollection.findOne(query);
			res.send({
				isVerified: seller?.status === 'verified' ? true : false,
			});
    })

    //delete user by admin
    app.delete('/user-delete/:uid', verifyToken,verifyAdmin, async(req,res)=>{
      const decoded = req.decoded;
				const uid = req.params.uid;
      const id = req.query.id;
      if (uid !== decoded.uid) {
        return res
          .status(403)
          .send({ message: 'Access Forbidden' });
      }
      const filter = { _id: new ObjectId(id)};
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });



    //order related API//
    //get all order filter by user uid
    app.get('/orders/:uid', async(req, res)=>{
      const decoded = req.decoded;
			const uid = req.params.uid;
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden'});
			}
      const query = { 'customer_info.customer_uid': uid };
      const orders = await orderCollection.find(query).toArray();
      res.send(orders);
    });


    //get a single order by user uid and order id
    app.get('/order/:uid' , verifyToken, async(req, res)=> {
      const decoded = req.decoded;
			const uid = req.params.uid;
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden'});
			}
      const id = req.query.id;
      const query = {_id: new ObjectId(id)};
      const order = await orderCollection.findOne(query);
      res.send(order);
    });

    //create a order by user
    app.post('/orders/:uid',verifyToken, async(req,res)=>{
      const decoded = req.decoded;
			const uid = req.params.uid;
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden'});
			}
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
      const productQuery = {
        _id: ObjectId(order.product_info?.product_id)
      };
      const option = {upsert: true};
      const orderedProduct = await productCollection.findOne(productQuery)

    });

    //Promotion related API//

    //get All Promoted Product
    app.get('/promoted-product', async(req, res)=>{
      const query = {promote: true};
      const result = await productCollection
      .find(query)
      .sort({createAt: -1})
      .toArray();
      res.send(result);
    });

    // make a product to promoted product
    app.patch('/promote-product/:uid',verifyToken,verifySeller, async(req, res)=>{
      const decoded = req.decoded;
				const uid = req.params.uid;
      const id = req.query.id;
      if (uid !== decoded.uid) {
        return res
          .status(403)
          .send({ message: 'Access Forbidden'});
      }
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
//create Payment Intent
app.post('/create-payment-intent/:uid', verifyToken, async(req,res)=>{
  const uid = req.params.uid;
			const decode = req.decoded;
			const id = req.query.id;
			if (uid !== decode.uid) {
				return res
					.status(401)
					.send({ message: 'Unauthorized Access'});
			}
			const query = { _id: new ObjectId(id) };
      const product = await productCollection.findOne(query);
      const price = product?.resell_price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price,
        currency:'usd',
        payment_method_types: ['card'],
      });
      res.send({clientSecret: paymentIntent.client_secret});
});

//save payment data to database
app.post('/payments/:uid',verifyToken, async(req,res)=>{
  const uid = req.params.uid;
			const decode = req.decoded;
			if (uid !== decode.uid) {
				return res
					.status(401)
					.send({ message: 'Unauthorized Access'});
			}
			const payment = req.body;
			const result = await paymentCollection.insertOne(payment);
			res.send(result);

      //set order status true after payment done
      const orderQuery = { _id: ObjectId(payment.orderId) };
			const option = { upsert: true };
			const orderUpdatedDoc = {
				$set: {
					order_status: true,
				},
			};
			const orderResult = await orderCollection.updateOne(
				orderQuery,
				orderUpdatedDoc,
				option
			);

      //set order status true and promote status false after payment done
			const productQuery = { _id: ObjectId(payment.product_id) };
			const productUpdatedDoc = {
				$set: {
					order_status: true,
					promote: false,
				},
			};
      const productResult = await productCollection.updateOne(
				productQuery,
				productUpdatedDoc,
				option
			);
})

  } finally {
    
    // await client.close();
  }
}
oldCarHat().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Welcome Everyone to OldCarHat!')
});

app.listen(port, () => {
  console.log(`OldCarHat app listening on port ${port}`)
})