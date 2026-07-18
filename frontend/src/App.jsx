import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  ShoppingCart, 
  User, 
  History, 
  MapPin, 
  Clock, 
  ArrowLeft, 
  Plus, 
  Minus, 
  Check, 
  ChevronRight, 
  Info, 
  Lock, 
  Phone,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function App() {
  // Navigation & Core State
  const [view, setView] = useState('splash'); // 'splash', 'login', 'home', 'detail', 'cart', 'history', 'tracking'
  const [user, setUser] = useState(null);
  
  // Catalog & Cart State
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [detailQuantity, setDetailQuantity] = useState(1.0); // in kg
  
  // Delivery details
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliverySlot, setDeliverySlot] = useState('morning'); // 'morning', 'noon', 'evening'
  const [balasoreLocation, setBalasoreLocation] = useState('Sahadevkhunta');
  
  // Order states
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // UI & Sandbox States
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [mockPaymentModal, setMockPaymentModal] = useState(null); // stores order payment context for mock UI

  // Local Balasore Landmark Locations
  const BALASORE_NEIGHBORHOODS = [
    'Sahadevkhunta',
    'OT Road',
    'Station Square (Baleswar)',
    'Kuruda',
    'Mallikashpur',
    'Balgopalpur',
    'Fakir Mohan Golai',
    'Somanathpur'
  ];

  // Delivery slots info
  const SLOTS = [
    { id: 'morning', time: '7:00 AM - 10:00 AM', label: 'Fresh Catch Morning' },
    { id: 'noon', time: '11:30 AM - 2:30 PM', label: 'Mid-day Lunch Slot' },
    { id: 'evening', time: '5:00 PM - 8:00 PM', label: 'Evening Dinner Slot' }
  ];

  // 1. Splash Screen timeout and Auto-Login
  useEffect(() => {
    const initApp = async () => {
      // Fetch Products from database
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        } else {
          throw new Error('Backend returned non-ok status');
        }
      } catch (err) {
        console.error('Failed to load products from server, using local fallbacks', err);
        // Fallback placeholder catalog in case backend isn't up yet
        setProducts([
          { id: 1, name: 'Fresh Ilishi (Hilsa)', description: 'Premium silver hilsa caught fresh, known for its signature rich taste.', price_per_kg: 1250, image_url: 'ilishi', category: 'Premium Fish' },
          { id: 2, name: 'Chilika Tiger Chingudi (Prawns)', description: 'Large sweet tiger prawns sourced from Chilika waters.', price_per_kg: 550, image_url: 'chingudi', category: 'Prawns & Crabs' },
          { id: 3, name: 'Fresh Ruhi (Rohu)', description: 'Local freshwater Rohu, perfect for traditional Odia Besara curry.', price_per_kg: 240, image_url: 'ruhi', category: 'Freshwater Fish' },
          { id: 4, name: 'Kankada (Mud Crabs)', description: 'Live mud crabs with firm meat, sourced from Balasore creeks.', price_per_kg: 600, image_url: 'kankada', category: 'Prawns & Crabs' }
        ]);
      }

      // Check user session
      const savedUser = localStorage.getItem('macha_user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setDeliveryAddress(userData.address);
        
        // Load past orders
        fetchUserOrders(userData.phone);
        
        setTimeout(() => setView('home'), 1500);
      } else {
        setTimeout(() => setView('login'), 1500);
      }
    };

    initApp();
  }, []);

  // Fetch past orders
  const fetchUserOrders = async (phone) => {
    try {
      const res = await fetch(`/api/orders/user/${phone}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  // Poll active order status if we are on tracking screen
  useEffect(() => {
    if (view !== 'tracking' || !selectedOrder) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${selectedOrder.id}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedOrder(data);
          // Update order in historical logs as well
          setOrders(prev => prev.map(o => o.id === data.id ? data : o));
        }
      } catch (err) {
        console.error('Polling tracking status failed:', err);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [view, selectedOrder]);

  // 2. Auth Handlers
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const phone = e.target.phone.value.trim();
    const address = e.target.address.value.trim();

    if (!name || !phone) {
      alert('Please fill out all required fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address })
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setDeliveryAddress(userData.address);
        localStorage.setItem('macha_user', JSON.stringify(userData));
        await fetchUserOrders(userData.phone);
        setView('home');
      } else {
        alert('Authentication failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Server connectivity issue. Simulating developer offline login.');
      // Offline fallback
      const mockUser = { id: 101, name, phone, address: address || 'Balasore Center' };
      setUser(mockUser);
      setDeliveryAddress(mockUser.address);
      setView('home');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('macha_user');
    setUser(null);
    setCart([]);
    setOrders([]);
    setView('login');
  };

  // 3. Cart handlers
  const addToCartDirect = (product, event) => {
    event.stopPropagation(); // Avoid opening detail screen
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity_kg: item.quantity_kg + 1.0 } 
            : item
        );
      }
      return [...prev, { product, quantity_kg: 1.0 }];
    });
  };

  const updateCartQuantity = (productId, amount) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity_kg + amount;
          return newQty > 0 ? { ...item, quantity_kg: parseFloat(newQty.toFixed(1)) } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setDetailQuantity(1.0);
    setView('detail');
  };

  const addDetailProductToCart = () => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === selectedProduct.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === selectedProduct.id 
            ? { ...item, quantity_kg: parseFloat((item.quantity_kg + detailQuantity).toFixed(1)) } 
            : item
        );
      }
      return [...prev, { product: selectedProduct, quantity_kg: detailQuantity }];
    });
    setView('home');
  };

  // 4. Cart calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.product.price_per_kg * item.quantity_kg), 0);
  const deliveryFee = cartSubtotal > 0 ? 39 : 0;
  const cartTotal = cartSubtotal + deliveryFee;

  // 5. Checkout & Razorpay Integration
  const handlePaymentCheckout = async () => {
    if (!deliveryAddress) {
      alert('Please fill in your delivery address');
      return;
    }

    setLoading(true);

    const orderPayload = {
      user_id: user.id,
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity_kg: item.quantity_kg,
        price: item.product.price_per_kg
      })),
      delivery_address: `${balasoreLocation} - ${deliveryAddress}`,
      delivery_slot: SLOTS.find(s => s.id === deliverySlot).time,
      total_amount: cartTotal
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (!res.ok) {
        throw new Error('Order creation api failed');
      }

      const orderData = await res.json(); // returns order_id, razorpay_order_id, is_mock, etc.

      if (orderData.is_mock) {
        // Run Sandbox Interactive UI modal fallback inside application environment
        setMockPaymentModal(orderData);
        setLoading(false);
      } else {
        // Trigger live/test Razorpay Standard Checkout overlay modal
        const options = {
          key: orderData.key_id,
          amount: Math.round(orderData.amount * 100),
          currency: 'INR',
          name: 'Macha Express',
          description: 'Fresh Seafood Delivery in Balasore',
          order_id: orderData.razorpay_order_id,
          handler: async function (response) {
            setLoading(true);
            try {
              const verifyRes = await fetch('/api/orders/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: orderData.order_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  is_mock: false
                })
              });

              if (verifyRes.ok) {
                // Success! Clear cart, go to tracking screen
                setCart([]);
                const trackingRes = await fetch(`/api/orders/${orderData.order_id}`);
                if (trackingRes.ok) {
                  const finalOrder = await trackingRes.json();
                  setSelectedOrder(finalOrder);
                  setView('tracking');
                  fetchUserOrders(user.phone);
                }
              } else {
                alert('Payment verification failed.');
              }
            } catch (err) {
              console.error('Payment verification API error:', err);
              alert('Error verifying payment.');
            } finally {
              setLoading(false);
            }
          },
          prefill: {
            name: user.name,
            contact: user.phone
          },
          notes: {
            address: orderPayload.delivery_address
          },
          theme: {
            color: '#0d9488'
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response){
          alert(`Payment failed! Reason: ${response.error.description}`);
          setLoading(false);
        });
        rzp.open();
      }
    } catch (err) {
      console.error('Checkout initialization failed:', err);
      alert('Error connecting to local backend server. Please verify backend state.');
      setLoading(false);
    }
  };

  // Confirm mock payment success/failure in sandbox mode
  const triggerMockPaymentResult = async (status) => {
    if (!mockPaymentModal) return;
    setLoading(true);

    const orderData = mockPaymentModal;
    setMockPaymentModal(null); // clear modal

    if (status === 'success') {
      try {
        const verifyRes = await fetch('/api/orders/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderData.order_id,
            razorpay_order_id: orderData.razorpay_order_id,
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_signature: `sig_mock_${Date.now()}`,
            is_mock: true
          })
        });

        if (verifyRes.ok) {
          setCart([]);
          const trackingRes = await fetch(`/api/orders/${orderData.order_id}`);
          if (trackingRes.ok) {
            const finalOrder = await trackingRes.json();
            setSelectedOrder(finalOrder);
            setView('tracking');
            fetchUserOrders(user.phone);
          }
        } else {
          alert('Failed to register mock transaction.');
        }
      } catch (err) {
        console.error('Mock signature registration failed:', err);
      } finally {
        setLoading(false);
      }
    } else {
      // failed mock order
      alert('Mock payment was cancelled or failed.');
      setLoading(false);
    }
  };

  // Filter products by category
  const filteredProducts = products.filter(p => 
    categoryFilter === 'All' || p.category === categoryFilter
  );

  return (
    <div className="app-container">
      {/* Android Device Status Bar */}
      <div className="status-bar">
        <span className="status-time">11:54 AM</span>
        <div className="status-bar-right">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5.5 13.5a9 9 0 0 1 13 0M1.5 9.5a15 15 0 0 1 21 0"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="12" x="3" y="6" rx="2"/><path d="M12 10v4M12 6V3"/></svg>
          <span>100%</span>
        </div>
      </div>

      {/* 1. Splash View */}
      {view === 'splash' && (
        <div className="screen">
          <div className="splash-screen">
            <div className="splash-logo-container">
              <div className="splash-circle">
                <ShoppingBag />
              </div>
            </div>
            <h1 className="splash-title">Macha Express</h1>
            <p className="splash-subtitle">Fresh Fish Delivery • Balasore, Odisha</p>
            <div className="spinner"></div>
          </div>
        </div>
      )}

      {/* 2. Login View */}
      {view === 'login' && (
        <div className="screen">
          <div className="login-screen">
            <div className="login-header">
              <h2>Welcome to Macha Express</h2>
              <p>Get premium fresh fish delivered to your doorstep in Balasore city</p>
            </div>
            
            <form onSubmit={handleLoginSubmit} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Your Name</label>
                <input 
                  type="text" 
                  name="name" 
                  className="glass-input" 
                  placeholder="Enter full name" 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Mobile Number (For delivery updates)</label>
                <div className="phone-input-wrapper">
                  <span className="country-code">+91</span>
                  <input 
                    type="tel" 
                    name="phone" 
                    className="glass-input" 
                    placeholder="10-digit mobile number" 
                    pattern="[0-9]{10}"
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Default Street Address / Landmark</label>
                <textarea 
                  name="address" 
                  className="glass-input" 
                  placeholder="House No, Lane name, Near Landmark" 
                  rows="3"
                  style={{ resize: 'none' }}
                ></textarea>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <div className="spinner" style={{ width: '18px', height: '18px' }}></div> : 'Enter Marketplace'}
              </button>
            </form>
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
              Powered by Razorpay Secure Payments
            </div>
          </div>
        </div>
      )}

      {/* 3. Home View */}
      {view === 'home' && (
        <>
          <div className="screen">
            <div className="home-header">
              <div className="user-info">
                <span className="user-greeting">Namaskar, {user?.name}</span>
                <span className="user-location">
                  <MapPin />
                  {balasoreLocation}, Baleswar
                </span>
              </div>
              <button onClick={handleLogout} className="avatar">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </button>
            </div>

            {/* Promo banner */}
            <div className="promo-banner">
              <div className="promo-text">
                <h3>Fresh River Catch</h3>
                <p>100% organic, chemical-free fish sourced directly from local rivers & coasts.</p>
                <span className="promo-badge">COUPON: FRESHBALESWAR</span>
              </div>
              <div style={{ fontSize: '40px', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))' }}>🐠</div>
            </div>

            {/* Category selection */}
            <div className="section-title">
              <span>Categories</span>
            </div>
            <div className="categories-container">
              {['All', 'Freshwater Fish', 'Premium Fish', 'Prawns & Crabs'].map(cat => (
                <button 
                  key={cat} 
                  className={`category-chip ${categoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products grid */}
            <div className="section-title">
              <span>Fresh Catch Today</span>
              <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
                In Stock
              </span>
            </div>

            <div className="products-grid">
              {filteredProducts.map(p => (
                <div key={p.id} className="product-card" onClick={() => openProductDetail(p)}>
                  <div className="product-image-container">
                    <div className={`fish-art ${p.image_url}`}></div>
                    <span className="stock-tag">Fresh</span>
                  </div>
                  <div className="product-info">
                    <h3 className="product-name">{p.name}</h3>
                    <p className="product-desc">{p.description}</p>
                    <div className="product-footer">
                      <div className="price-tag">
                        ₹{p.price_per_kg}
                        <span className="price-unit">/kg</span>
                      </div>
                      <button className="add-btn" onClick={(e) => addToCartDirect(p, e)}>
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom navigation */}
          <div className="nav-bar">
            <button className="nav-item active" onClick={() => setView('home')}>
              <ShoppingBag />
              <span>Shop</span>
            </button>
            <button className="nav-item" onClick={() => setView('cart')}>
              <div className="nav-badge-container">
                <ShoppingCart />
                {cart.length > 0 && <span className="nav-badge">{cart.reduce((s,i)=>s+i.quantity_kg,0)}kg</span>}
              </div>
              <span>Cart</span>
            </button>
            <button className="nav-item" onClick={() => setView('history')}>
              <History />
              <span>Orders</span>
            </button>
          </div>
        </>
      )}

      {/* 4. Product Detail View */}
      {view === 'detail' && selectedProduct && (
        <div className="screen">
          <div className="back-btn-container">
            <button className="circle-btn" onClick={() => setView('home')}>
              <ArrowLeft size={18} />
            </button>
            <h3 style={{ fontSize: '18px' }}>Product Details</h3>
          </div>

          <div className="detail-view">
            <div className="detail-image">
              <div className={`fish-art ${selectedProduct.image_url}`} style={{ height: '200px' }}></div>
            </div>

            <span className="detail-category">{selectedProduct.category}</span>
            <h2 className="detail-name">{selectedProduct.name}</h2>
            
            <p className="detail-desc">{selectedProduct.description}</p>

            <div className="weight-selector-card glass-panel">
              <div className="weight-slider-header">
                <span className="weight-label">Select Weight (kg)</span>
                <span className="weight-value">{detailQuantity} kg</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="5.0" 
                step="0.5" 
                value={detailQuantity} 
                onChange={(e) => setDetailQuantity(parseFloat(e.target.value))}
                className="slider-input"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Min: 0.5 kg</span>
                <span>Max: 5.0 kg</span>
              </div>
            </div>

            <div className="detail-footer-price">
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Price</span>
                <div className="price-tag" style={{ fontSize: '24px' }}>₹{Math.round(selectedProduct.price_per_kg * detailQuantity)}</div>
              </div>
              
              <button className="btn-primary" onClick={addDetailProductToCart} style={{ padding: '16px 28px' }}>
                <ShoppingCart size={18} />
                Add to Basket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Cart View */}
      {view === 'cart' && (
        <>
          <div className="screen">
            <div className="back-btn-container">
              <button className="circle-btn" onClick={() => setView('home')}>
                <ArrowLeft size={18} />
              </button>
              <h3 style={{ fontSize: '18px' }}>Shopping Basket</h3>
            </div>

            <div className="cart-view">
              {cart.length === 0 ? (
                <div className="empty-cart-state">
                  <ShoppingCart />
                  <h3>Your basket is empty</h3>
                  <p>Browse our catalog of fresh fish and add items to get started!</p>
                  <button className="btn-primary" onClick={() => setView('home')}>Start Shopping</button>
                </div>
              ) : (
                <>
                  <div className="cart-items-list">
                    {cart.map(item => (
                      <div key={item.product.id} className="cart-item glass-panel">
                        <div className="cart-item-image">
                          <div className={`fish-art ${item.product.image_url}`} style={{ height: '48px' }}></div>
                        </div>
                        <div className="cart-item-details">
                          <h4 className="cart-item-name">{item.product.name}</h4>
                          <span className="price-tag" style={{ fontSize: '14px' }}>₹{item.product.price_per_kg}/kg</span>
                        </div>
                        <div className="qty-counter">
                          <button className="qty-btn" onClick={() => updateCartQuantity(item.product.id, -0.5)}>
                            <Minus size={12} />
                          </button>
                          <span className="qty-num">{item.quantity_kg}kg</span>
                          <button className="qty-btn" onClick={() => updateCartQuantity(item.product.id, 0.5)}>
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Location & Address details */}
                  <span className="checkout-section-header">Delivery Destination (Balasore Only)</span>
                  <div className="address-box glass-panel">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Select Balasore Locality</label>
                      <select 
                        className="glass-input" 
                        value={balasoreLocation} 
                        onChange={(e) => setBalasoreLocation(e.target.value)}
                        style={{ background: '#0a0f1d' }}
                      >
                        {BALASORE_NEIGHBORHOODS.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Delivery Address Details</label>
                      <input 
                        type="text" 
                        className="glass-input" 
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="House no, Street name, Land Mark"
                      />
                    </div>
                  </div>

                  {/* Delivery slot selection */}
                  <span className="checkout-section-header">Select Delivery Slot</span>
                  <div className="slot-selector-container">
                    {SLOTS.map(slot => (
                      <div 
                        key={slot.id} 
                        className={`slot-chip ${deliverySlot === slot.id ? 'active' : ''}`}
                        onClick={() => setDeliverySlot(slot.id)}
                      >
                        <div className="slot-time">{slot.time}</div>
                        <div className="slot-day">{slot.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Bill Details */}
                  <span className="checkout-section-header">Payment breakdown</span>
                  <div className="bill-summary glass-panel">
                    <div className="bill-row">
                      <span>Fish Items Subtotal</span>
                      <span>₹{cartSubtotal}</span>
                    </div>
                    <div className="bill-row">
                      <span>Express Delivery Charge</span>
                      <span>₹{deliveryFee}</span>
                    </div>
                    <div className="bill-row total">
                      <span>To Pay</span>
                      <span>₹{cartTotal}</span>
                    </div>
                  </div>

                  {/* Payment checkout buttons */}
                  <div className="payment-footer">
                    <button className="btn-primary" onClick={handlePaymentCheckout} disabled={loading} style={{ width: '100%' }}>
                      {loading ? (
                        <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
                      ) : (
                        <>
                          <ShieldCheck size={18} />
                          Pay INR {cartTotal} via Razorpay
                        </>
                      )}
                    </button>
                    <span className="payment-notice">
                      <Lock size={10} /> Secure 128-bit SSL Payment Verification
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom navigation */}
          <div className="nav-bar">
            <button className="nav-item" onClick={() => setView('home')}>
              <ShoppingBag />
              <span>Shop</span>
            </button>
            <button className="nav-item active" onClick={() => setView('cart')}>
              <div className="nav-badge-container">
                <ShoppingCart />
                {cart.length > 0 && <span className="nav-badge">{cart.reduce((s,i)=>s+i.quantity_kg,0)}kg</span>}
              </div>
              <span>Cart</span>
            </button>
            <button className="nav-item" onClick={() => setView('history')}>
              <History />
              <span>Orders</span>
            </button>
          </div>
        </>
      )}

      {/* 6. Order History View */}
      {view === 'history' && (
        <>
          <div className="screen">
            <div className="back-btn-container">
              <button className="circle-btn" onClick={() => setView('home')}>
                <ArrowLeft size={18} />
              </button>
              <h3 style={{ fontSize: '18px' }}>My Delivery Orders</h3>
            </div>

            <div className="history-view">
              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                  <History size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                  <p>You have not placed any orders yet.</p>
                </div>
              ) : (
                orders.map(order => (
                  <div 
                    key={order.id} 
                    className="history-card glass-panel"
                    onClick={() => {
                      setSelectedOrder(order);
                      setView('tracking');
                    }}
                  >
                    <div className="history-header">
                      <span className="history-date">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                      <span className={`history-status-badge ${order.status.toLowerCase()}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="history-items-summary">
                      {order.items?.map(item => `${item.product_name} (${item.quantity_kg}kg)`).join(', ')}
                    </div>

                    <div className="history-footer">
                      <span>ID: #{order.id}0025</span>
                      <span>Total: <strong className="history-amount">₹{order.total_amount}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom navigation */}
          <div className="nav-bar">
            <button className="nav-item" onClick={() => setView('home')}>
              <ShoppingBag />
              <span>Shop</span>
            </button>
            <button className="nav-item" onClick={() => setView('cart')}>
              <div className="nav-badge-container">
                <ShoppingCart />
                {cart.length > 0 && <span className="nav-badge">{cart.reduce((s,i)=>s+i.quantity_kg,0)}kg</span>}
              </div>
              <span>Cart</span>
            </button>
            <button className="nav-item active" onClick={() => setView('history')}>
              <History />
              <span>Orders</span>
            </button>
          </div>
        </>
      )}

      {/* 7. Live Order Tracking screen */}
      {view === 'tracking' && selectedOrder && (
        <div className="screen">
          <div className="back-btn-container">
            <button className="circle-btn" onClick={() => setView('history')}>
              <ArrowLeft size={18} />
            </button>
            <h3 style={{ fontSize: '18px' }}>Delivery Status</h3>
          </div>

          <div className="tracking-view">
            <div className="success-badge">
              <div className="success-check-circle">
                <Check />
              </div>
              <h2 className="success-title">Order Confirmed!</h2>
              <span className="success-id">Razorpay Payment Verified • ID: #{selectedOrder.id}0025</span>
            </div>

            {/* Vertical Tracker */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Delivery Updates
              </h3>
              
              <div className="steps-tracker">
                <div className="steps-line"></div>
                <div className="steps-line-progress" style={{ 
                  height: selectedOrder.status === 'DELIVERED' ? '100%' :
                          selectedOrder.status === 'OUT_FOR_DELIVERY' ? '66%' :
                          selectedOrder.status === 'PREPARING' ? '33%' : '0%'
                }}></div>

                <div className={`step-item ${['ORDERED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(selectedOrder.status) ? 'completed' : ''}`}>
                  <div className="step-bullet"></div>
                  <div className="step-info">
                    <span className="step-title">Order Received</span>
                    <span className="step-desc">Your order is logged and payment of ₹{selectedOrder.total_amount} is verified</span>
                  </div>
                </div>

                <div className={`step-item ${selectedOrder.status === 'PREPARING' ? 'active' : ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(selectedOrder.status) ? 'completed' : ''}`}>
                  <div className="step-bullet"></div>
                  <div className="step-info">
                    <span className="step-title">Cleaned & Packed</span>
                    <span className="step-desc">Fish is cleaned, quality inspected, and cold-packed at Baleswar harbor outlet</span>
                  </div>
                </div>

                <div className={`step-item ${selectedOrder.status === 'OUT_FOR_DELIVERY' ? 'active' : selectedOrder.status === 'DELIVERED' ? 'completed' : ''}`}>
                  <div className="step-bullet"></div>
                  <div className="step-info">
                    <span className="step-title">Out for Delivery</span>
                    <span className="step-desc">Our delivery partner is bringing it to your address: {selectedOrder.delivery_address}</span>
                  </div>
                </div>

                <div className={`step-item ${selectedOrder.status === 'DELIVERED' ? 'completed active' : ''}`}>
                  <div className="step-bullet"></div>
                  <div className="step-info">
                    <span className="step-title">Fresh Catch Delivered</span>
                    <span className="step-desc">Successfully delivered. Enjoy your fresh seafood meal!</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="tracking-order-details glass-panel" style={{ marginTop: '20px' }}>
              <h4>Items Summary</h4>
              <div className="tracking-items">
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>{item.product_name} x {item.quantity_kg}kg</span>
                    <span>₹{item.price * item.quantity_kg}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px', fontWeight: 'bold' }}>
                  <span>Total Paid (INR)</span>
                  <span style={{ color: 'var(--accent-coral)' }}>₹{selectedOrder.total_amount}</span>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={() => setView('home')} style={{ width: '100%', marginTop: '8px' }}>
              Back to Marketplace
            </button>
          </div>
        </div>
      )}

      {/* MOCK INTERACTIVE RAZORPAY MODAL OVERLAY */}
      {mockPaymentModal && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div className="glass-panel" style={{
            padding: '24px',
            width: '90%',
            maxWidth: '340px',
            backgroundColor: '#0a1020',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '2px solid rgba(14, 165, 233, 0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: '#0ea5e9', marginBottom: '12px' }}>
              <ShieldCheck size={48} />
            </div>
            
            <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Razorpay Checkout</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Sandbox Simulation (INR Payment Gateway)
            </p>

            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '12px', 
              padding: '12px', 
              fontSize: '13px', 
              marginBottom: '20px',
              textAlign: 'left',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Merchant:</span>
                <strong style={{ color: '#fff' }}>Macha Express</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Order ID:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#fff' }}>
                  {mockPaymentModal.razorpay_order_id.slice(0, 16)}...
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '8px', paddingTop: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Amount:</span>
                <strong style={{ color: 'var(--accent-coral)', fontSize: '15px' }}>₹{mockPaymentModal.amount}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn-primary" 
                onClick={() => triggerMockPaymentResult('success')}
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: 'none' }}
              >
                Simulate Success Payment
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => triggerMockPaymentResult('failed')}
              >
                Cancel / Fail Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
