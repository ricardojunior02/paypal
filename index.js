require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const paypal = require('paypal-rest-sdk');


const app = express();

// View engine
app.set('view engine','ejs');

//Body parser
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

paypal.configure({
    mode: 'sandbox',
    client_id: process.env.PAYPAL_CLIENT_ID,
    client_secret: process.env.PAYPAL_SECRET,
});

app.get("/",(req, res) => {
    res.render('index');
});

app.post('/buy', (req, res) => {

    const { id, name, price, amount } = req.body;

    const total = price * amount;

    const create_payment_json = {
        intent: "sale",
        payer: {
            payment_method: "paypal"
        },
        redirect_urls: {
            return_url: `http://localhost:3333/checkout?total=${total}&id=${id}`,
            cancel_url: "http://cancel.url"
        },
        transactions: [{
            item_list: {
                items: [{
                    name: name,
                    sku: name,
                    price: price,
                    currency: "BRL",
                    quantity: amount
                }]
            },
            amount: {
                currency: "BRL",
                total: total
            },
            description: "This is the payment description."
        }]
    };
    
    
    paypal.payment.create(create_payment_json, (error, payment) => {
        if (error) {
            return error.message;
        } else {
            for(var i = 0; payment.links.length; i++){
                const p = payment.links[i];
                if(p.rel === 'approval_url'){
                    return res.redirect(p.href)
                }
            }
        }
    });

});

app.get('/checkout', (req, res) => {
    const { paymentId, PayerID, total } = req.query;

    const checkout = {
        payer_id: PayerID,
        transactions: [
            {
                amount: {
                    currency: 'BRL',
                    total: total
                }
            }
        ]
    };

    paypal.payment.execute(paymentId, checkout, (err, payment) => {
        if(err) {
            return res.status(400).json(err.message);
        }else{
            return res.status(201).json(payment);
        };
    })
});

app.get('/create-plan', (req, res) => {

    const plan = {
        "description": "Crie seu plano familiar e aproveite",
        "merchant_preferences": {
        "auto_bill_amount": "yes",
        "cancel_url": "http://www.cancel.com",
        "initial_fail_amount_action": "continue",
        "max_fail_attempts": "1",
        "return_url": "http://www.success.com",
        "setup_fee": {
            "currency": "BRL",
            "value": "25"
        }
    },
    "name": "Testing1-Regular1",
    "payment_definitions": [
        {
            "amount": {
                "currency": "BRL",
                "value": "100"
            },
            "charge_models": [
                {
                    "amount": {
                        "currency": "BRL",
                        "value": "10.60"
                    },
                    "type": "SHIPPING"
                },
                {
                    "amount": {
                        "currency": "BRL",
                        "value": "20"
                    },
                    "type": "TAX"
                }
            ],
            "cycles": "0",
            "frequency": "MONTH",
            "frequency_interval": "1",
            "name": "Plano familiar",
            "type": "REGULAR"
        },
        {
            "amount": {
                "currency": "BRL",
                "value": "20"
            },
            "charge_models": [
                {
                    "amount": {
                        "currency": "BRL",
                        "value": "10.60"
                    },
                    "type": "SHIPPING"
                },
                {
                    "amount": {
                        "currency": "BRL",
                        "value": "20"
                    },
                    "type": "TAX"
                }
            ],
            "cycles": "4",
            "frequency": "MONTH",
            "frequency_interval": "1",
            "name": "Teste Gratuito",
            "type": "TRIAL"
        }
    ],
    "type": "INFINITE"
    };

    paypal.billingPlan.create(plan, (err, billingPlan) => {
        if(err) {
            return res.status(400).json(err)
        }else{
           return res.json(billingPlan) 
        }
    });
});

app.get('/list-plans', (req, res) => {
    paypal.billingPlan.list({status: 'ACTIVE'}, (err, plan) => {
        if(err){
            return res.status(400).json(err);
        }else{
            return res.status(200).json(plan);
        }
    });
});

app.get('/active-plan/:id', (req, res) => {
    const update = [
        {
            'op': 'replace',
            'path': '/',
            'value': {
                'state': 'ACTIVE',
            }
        }
    ]

    paypal.billingPlan.update(req.params.id, update, (err, plan) => {
        if(err){
            return res.status(400).json(err)
        }else{
            return res.status(200).json(plan)
        }
    });
});

app.post('/sub', (req, res) => {
    const { email } = req.body;
    const idPlan = 'P-42V18672Y2091993FZ555KBA';
    const isoDate = new Date(Date.now());
    isoDate.setSeconds(isoDate.getSeconds() + 4);
    isoDate.toISOString().slice(0, 19) + 'z';

    const dataSub = {
        'name': 'Assinatura do Plano Familia',
        'description': 'Plano familia',
        'start_date': isoDate,
        'payer': {
            'payment_method': 'paypal',
        },
        'plan': {
            'id': idPlan,
        },
        'override_merchant_preferences': {
            'return_url': `http://localhost:3333/sub-return?email=${email}`,
            'cancel_url': 'http://localhost:3333'
        }
    };

    paypal.billingAgreement.create(dataSub, (err, signature) => {
        if(err){
            return res.status(400).json(err);
        }else{
            return res.status(201).json(signature);
        }
    })
});

app.get('/sub-return', (req, res) => {
    const { email, token } = req.query;

    paypal.billingAgreement.execute(token,{}, (err, signature) => {
        if(err){
            return res.status(400).json(err);
        }else{
            return res.status(200).json(signature)
        }
    });
});

app.get('/info/:id', (req, res) => {
    const { id } = req.params;

    paypal.billingAgreement.get(id, (err, signature) => {
        if(err){
            return res.status(400).json(err);
        }else{
            return res.status(200).json(signature);
        }
    });
});

app.get('/cancel/:id', (req, res) => {
    const { id } = req.params;

    paypal.billingAgreement.cancel(id,{note: 'Cliente cancelou'}, (err, signature) => {
        if(err){
            return res.status(400).json(err);
        }else{
            return res.status(200).json(signature);
        }
    });
});

app.listen(3333, () => {
    console.log('Running!')
});

