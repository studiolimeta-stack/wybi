const LEFT_MOVING_TESTS = [
  'A new SaaS plan',
  'Online course',
  'Physical product',
  'Coaching package',
  'Digital template',
  'Newsletter membership',
  'Mobile app',
  'Service package',
  'Fitness membership',
  'Event ticket',
];

const RIGHT_MOVING_TESTS = [
  'E-commerce product',
  'Workshop ticket',
  'Agency retainer',
  'Freelance offer',
  'Community membership',
  'Book launch',
  'AI tool',
  'Consulting call',
  'SaaS add-on',
  'Meal plan',
];

function MarqueeRow({ items, direction }) {
  return (
    <div className="example-marquee" aria-label="Example offers you can test">
      <div className={`example-marquee-track example-marquee-track-${direction}`}>
        {[false, true].map((isDuplicate) => (
          <div key={String(isDuplicate)} className="example-marquee-group" aria-hidden={isDuplicate}>
            {items.map((item) => (
              <span key={item} className="example-test-chip">
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExampleTestMarquee() {
  return (
    <div className="mt-7 space-y-3">
      <MarqueeRow items={LEFT_MOVING_TESTS} direction="left" />
      <MarqueeRow items={RIGHT_MOVING_TESTS} direction="right" />
    </div>
  );
}
