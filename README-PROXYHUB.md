# ProxyHub

Website riêng tư để kiểm thử kho proxy, đơn hàng và bảo hành 30 ngày. Giữ bố cục, hiệu ứng hạt và lựa chọn sáng/tối đã được duyệt.

## Vận hành

Chủ Site đăng nhập với ChatGPT, vào Dashboard. Email chủ đã được cấu hình phía server cho quyền quản trị; khách không thể tự bật quyền này. Vào Cấu hình bán hàng để đặt giá HTTP và SOCKS5, nhập hướng dẫn thanh toán (ngân hàng/số tài khoản/chủ tài khoản nếu chuyển khoản) và bật các gói muốn bán. Khi chưa cấu hình, gói không mở bán. Có hai cách thanh toán: chuyển khoản xác nhận thủ công, hoặc nạp ví qua SePay rồi mua bằng số dư để nhận hàng tự động. Khách ghi PH + 8 ký tự đầu mã đơn và quản trị viên kiểm tra tiền thực nhận trước khi duyệt.

Nhập kho dạng IPv4 công khai:port:user:pass, tối đa 500 dòng / 200 KB. Có thể chọn giao thức, vị trí và ngày hết hạn nguồn. Proxy trùng (cùng loại/IP/port/user) được bỏ qua. Credentials được mã hóa AES-256-GCM; không xuất hiện trong API kho. Khóa PROXY_ENCRYPTION_KEY là Site secret đã cấu hình; không xoay/xóa khóa khi còn dữ liệu mã hóa.

Khách tạo đơn, quản trị viên chỉ duyệt sau khi xác nhận nhận đủ tiền. Server kiểm tra live trước khi cấp; thiếu kho thì đơn vẫn chờ. Một proxy không được cấp trùng cho hai dòng. Giá chốt được lưu trong đơn. Bảo hành tính từ lúc cấp, không phải lúc đặt đơn. Khách chỉ xuất được proxy còn hạn của mình. File TXT luôn lấy proxy hiện tại tại thời điểm xuất.

Sửa thông tin user/password trong kho giữ nguyên hạn khách; thay credentials yêu cầu kiểm tra lại. Proxy cũ sau bảo hành được cách ly, giữ lại phục vụ lịch sử. Hạn nguồn (nếu khai báo) phải đủ dài cho hết hạn đơn mới hoặc hạn còn lại của đơn bảo hành.

## Checker và bảo hành

Check HTTP và SOCKS5 bằng outbound TCP; yêu cầu đích kiểm tra trả HTTP 204 sau khi xác thực/kết nối. Xác nhận die sau 3 lần lỗi liên tiếp cách nhau tối thiểu 5 phút. Check lại nhiều lần ngay lập tức không làm tăng đủ 3 lần. Trước mỗi đợt có kiểm tra đích mạng từ server; lỗi mạng checker thì không đánh dấu proxy die. Cloudflare chặn một số địa chỉ/port: proxy đó ghi Checker không hỗ trợ, không bị thay dựa trên kết luận sai.

Mỗi đợt kiểm tra tối đa 20 proxy, ưu tiên các dòng khách còn hạn; xử lý tối đa 5 lần bảo hành. Chọn reserve cùng giao thức, kiểm tra live lại, thay đúng slot, giữ nguyên thời hạn, lưu lịch sử và thông báo. Hết reserve live thì giữ dòng cũ, báo khách và thử lại ở lần chạy tiếp theo. Kho càng lớn thì chu kỳ quét toàn bộ càng dài.

Cơ sở dữ liệu D1: schema Drizzle và migration lưu trong source. Lock chống chạy chồng và batch có guard để rollback nếu điều kiện cấp/thay bị thay đổi. Không có DDL chạy khi người dùng mở web.

## Chạy khi web đóng — chỉ dành cho Site riêng

Lịch kiểm tra/bảo hành hàng giờ đã được tạo và bật, theo múi giờ Asia/Saigon. Nền tảng giới hạn tối đa một lượt lịch mỗi giờ; chưa có lịch 5 phút. Có thể chạy nút Check / bảo hành trong quản trị, vẫn áp dụng khoảng cách tối thiểu 5 phút khi đếm lỗi. Muốn lịch 5 phút cần một dịch vụ cron/VPS riêng được cấu hình an toàn.

Đường ghi: POST /api/maintenance. Đọc đối chiếu: GET /api/maintenance. Truy cập bằng service credential do get_site cung cấp, trong header OAI-Sites-Authorization. Không lưu token vào source, file hoặc log. Route chỉ sử dụng trên Site được xác nhận owner-private; dispatcher của Sites là biên xác thực. Người dùng có identity phải dùng action maintenance được kiểm tra quyền admin tại /api/shop.

**Không đổi Site sang public trước khi thay route maintenance bằng xác thực service riêng.** Bản hiện tại được giữ riêng theo yêu cầu của chủ. Tác vụ định kỳ phải đọc lại Site; nếu quyền truy cập không còn owner-private thì dừng và báo cần cấu hình, không gọi updater.

Mỗi tác vụ định kỳ: lấy metadata/get_site của Site được liên kết; kiểm tra active, owner và owner-private; lấy supported service token trong bộ nhớ; POST /api/maintenance; GET đối chiếu latest timestamp và counts. Không build/deploy cho cập nhật dữ liệu. Không log credentials, không đọc kho đầy đủ. Bình thường im lặng; báo khi không còn quyền riêng tư hoặc lỗi yêu cầu chủ xử lý. 409 do chạy chồng thì chờ lượt sau.

Helper scripts/run-maintenance.mjs nhận JSON {url,token} qua stdin ẩn, gửi POST và GET để kiểm tra đường chạy này. Chỉ gửi credential về đúng Site.

## Kiểm thử

`node tests/run-shop.mjs`: dữ liệu SQLite riêng; không tác động dữ liệu thật. Bao gồm nhập/loại địa chỉ private, mã hóa, idempotency, phân quyền, thiếu kho, cấp trùng, cooldown, hết reserve, thay đúng dòng/giữ hạn, export mới, mất mạng checker, hết hạn, rollback batch, và HTTP/SOCKS5 handshake qua TCP loopback giả lập.

`npm run build`; TypeScript và ESLint. Runtime Windows có thể không khởi động được Workers; dùng preview.config.mts chỉ để xem frontend, API thực kiểm thử qua bản Site riêng đã xuất bản.

Frontend chỉ lưu lựa chọn sáng/tối trong localStorage. Kho, đơn, lịch sử và thông báo được lưu trên server. Hình dashboard ở phần giới thiệu ghi Minh họa, không phải số liệu tài khoản.
# Sản phẩm khác và kho riêng

Dashboard → Sản phẩm khác → Thêm sản phẩm. Chọn Tài khoản, Mã key, Nội dung text, Link hoặc Link tải file; đặt tên, mô tả và giá. Mỗi sản phẩm có kho riêng. Nhập list hoặc TXT: một dòng là một đơn vị hàng, tối đa 500 dòng mỗi lần; dòng giống nhau trong cùng kho được bỏ qua. Link tải file nhận URL của file đã lưu ở dịch vụ của chủ cửa hàng, không upload file nhị phân lên web này.

Nội dung kho được mã hóa bằng khóa hiện có. Khi admin xác nhận thanh toán và duyệt đơn, kho tự cấp đúng số lượng, đánh dấu đã bán và giao vào Sản phẩm đã mua. Giao hàng có khóa và ràng buộc dữ liệu để không cấp trùng; thiếu kho thì giữ đơn chờ. Nội dung chỉ xuất cho người mua, hỗ trợ copy từng dòng, copy full và TXT. Sản phẩm khác không chạy checker hoặc tự bảo hành như proxy. Đơn thanh toán bằng ví được tự giao sau khi trừ số dư, không cần duyệt tay.

Ô số lượng cho phép xóa để gõ lại, chỉ chấp nhận số nguyên 1–25 trước khi tạo đơn. Copy từng proxy luôn truyền đúng một ID, độc lập với ô chọn tất cả. Copy full lấy toàn bộ proxy còn hạn.

## SePay và ví số dư

Cấu hình bán hàng → SePay: nhập API Token Production, Tải danh sách ngân hàng, chọn tài khoản rồi Kiểm tra và bật. Token được mã hóa, không trả qua snapshot. Chưa nhập token thì nạp tiền mặc định tắt. Dùng API v2 Production; không nhận token Test mode để tránh dùng tiền giả mua kho thật.

Khách vào Ví và nạp tiền, tạo mã PHN (mỗi yêu cầu một mã), chuyển đúng số tiền và nội dung. SePay phải trả giao dịch tiền vào đúng tài khoản, mã, số tiền và thời gian; giao dịch có UUID duy nhất và chỉ cộng một lần. Sai số tiền, quá hạn hoặc nhiều giao dịch cùng mã chuyển REVIEW, chưa cộng. Tiền ra, sai tài khoản và sai mã bị bỏ qua. Mã có thời hạn 24 giờ, 1.000–100.000.000đ, tối đa 3 yêu cầu chờ.

Đối soát khi khách mở ví: 30 giây/lần; có nút Kiểm tra tiền. Lịch nền hiện có gọi /api/maintenance mỗi giờ, đối soát tối đa 5 yêu cầu chờ rồi kiểm tra proxy; không tạo lịch trùng. API được kiểm soát nhịp và khóa xử lý. Web hiện riêng tư nên không có webhook công khai/realtime. Khi muốn công khai, phải thay xác thực endpoint lịch nền và triển khai webhook được xác thực riêng.

Ví dùng sổ giao dịch với mã tham chiếu duy nhất. Mua bằng số dư trừ tiền và cấp hàng trong cùng một D1 batch có guard; kho thiếu hoặc batch lỗi không mất tiền. Đơn ví không được admin duyệt như đơn thủ công. Giá đơn chốt khi tạo; retry cùng request ID không trừ lại. Khách chỉ đọc ví, yêu cầu nạp và nội dung hàng của mình. Không có thao tác cộng tiền thủ công hoặc hoàn tiền ngân hàng trong bản này; REVIEW cần kiểm tra giao dịch thực.

Chưa có API Token hoặc giao dịch thật để kiểm thử Production. Kiểm thử ví/SePay dùng dữ liệu và phản hồi API cách ly; cần test nạp thật số tiền nhỏ sau khi cấu hình.
