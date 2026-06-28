import re
import sys
import os

def process_file(filepath):
    if not os.path.exists(filepath):
        return

    with open(filepath, 'r') as f:
        content = f.read()

    # Add BouncingButton import if not present
    if "import { BouncingButton }" not in content and "BouncingButton" not in content:
        content = re.sub(r"(import React.*?;\n)", r"\1import { BouncingButton } from '../components/ui/BouncingButton';\n", content, count=1)

    # Replace TouchableOpacity with BouncingButton
    content = re.sub(r"<TouchableOpacity", r"<BouncingButton", content)
    content = re.sub(r"</TouchableOpacity>", r"</BouncingButton>", content)
    
    # Increase border radii for premium roundness
    content = re.sub(r"borderRadius:\s*8\b", "borderRadius: 16", content)
    content = re.sub(r"borderRadius:\s*12\b", "borderRadius: 20", content)
    content = re.sub(r"borderRadius:\s*10\b", "borderRadius: 16", content)

    # Soften and expand shadows
    content = re.sub(r"shadowOpacity:\s*0\.[1-9]\d*", "shadowOpacity: 0.08", content)
    content = re.sub(r"shadowRadius:\s*[1-9]\b", "shadowRadius: 16", content)
    content = re.sub(r"elevation:\s*[1-5]\b", "elevation: 4", content)

    with open(filepath, 'w') as f:
        f.write(content)

files = [
    "mobile/src/screens/OrderPlacedScreen.tsx",
    "mobile/src/screens/OrderConfirmedScreen.tsx",
    "mobile/src/screens/OrderHistoryScreen.tsx",
    "mobile/src/screens/RateOrderScreen.tsx",
    "mobile/src/screens/ProfileScreen.tsx",
    "mobile/src/screens/AddressBookScreen.tsx",
    "mobile/src/screens/AddressScreen.tsx",
    "mobile/src/screens/WalletScreen.tsx",
    "mobile/src/screens/LoyaltyScreen.tsx",
    "mobile/src/screens/NotificationsScreen.tsx",
    "mobile/src/screens/SubscriptionScreen.tsx",
    "mobile/src/screens/SubscriptionDetailScreen.tsx",
    "mobile/src/screens/LiveKitchenScreen.tsx",
    "mobile/src/screens/MyPlansScreen.tsx",
    "mobile/src/screens/SupportScreen.tsx",
    "mobile/src/screens/RenewSubscriptionScreen.tsx",
    "mobile/src/screens/HelpScreen.tsx",
    "mobile/src/screens/OnboardingScreen.tsx"
]

for f in files:
    process_file(f)
    print(f"Processed {f}")

