#include <string>
#include <vector>
#include <memory>

namespace facebook {
namespace react {

class DebugStringConvertible;
struct DebugStringConvertibleOptions {
  bool format{true};
};

class Sealable {
public:
    Sealable();
    virtual ~Sealable();
    void ensureUnsealed() const;
};

Sealable::Sealable() {}
Sealable::~Sealable() {}
void Sealable::ensureUnsealed() const {}

class ShadowNode {
public:
    virtual ~ShadowNode();
    std::string getDebugName() const;
    std::string getDebugValue() const;
    std::vector<std::shared_ptr<DebugStringConvertible>> getDebugChildren() const;
};

ShadowNode::~ShadowNode() {}
std::string ShadowNode::getDebugName() const { return ""; }
std::string ShadowNode::getDebugValue() const { return ""; }
std::vector<std::shared_ptr<DebugStringConvertible>> ShadowNode::getDebugChildren() const { return {}; }

class BaseViewProps {
public:
    virtual ~BaseViewProps();
    std::string getDebugProps() const;
};
BaseViewProps::~BaseViewProps() {}
std::string BaseViewProps::getDebugProps() const { return ""; }

class YogaStylableProps {
public:
    virtual ~YogaStylableProps();
    std::string getDebugProps() const;
};
YogaStylableProps::~YogaStylableProps() {}
std::string YogaStylableProps::getDebugProps() const { return ""; }

class LayoutableShadowNode {
public:
    virtual ~LayoutableShadowNode();
    std::string getDebugProps() const;
};
LayoutableShadowNode::~LayoutableShadowNode() {}
std::string LayoutableShadowNode::getDebugProps() const { return ""; }

class Props {
public:
    virtual ~Props();
    std::string getDebugProps() const;
};
Props::~Props() {}
std::string Props::getDebugProps() const { return ""; }

class DebugStringConvertible {
public:
    virtual ~DebugStringConvertible();
    std::string getDebugName() const;
    std::string getDebugValue() const;
    std::vector<std::shared_ptr<DebugStringConvertible>> getDebugChildren() const;
    std::string getDebugDescription(DebugStringConvertibleOptions) const;
    std::string getDebugPropsDescription(DebugStringConvertibleOptions) const;
    std::string getDebugChildrenDescription(DebugStringConvertibleOptions) const;
};

DebugStringConvertible::~DebugStringConvertible() {}
std::string DebugStringConvertible::getDebugName() const { return ""; }
std::string DebugStringConvertible::getDebugValue() const { return ""; }
std::vector<std::shared_ptr<DebugStringConvertible>> DebugStringConvertible::getDebugChildren() const { return {}; }
std::string DebugStringConvertible::getDebugDescription(DebugStringConvertibleOptions) const { return ""; }
std::string DebugStringConvertible::getDebugPropsDescription(DebugStringConvertibleOptions) const { return ""; }
std::string DebugStringConvertible::getDebugChildrenDescription(DebugStringConvertibleOptions) const { return ""; }

}
}
